"""Tests for routes/chat.py (discovery + suggestion chaining)."""


# =============================== discover ==============================
def test_discover_missing_fields(client):
    resp = client.post("/api/chat/discover", json={"restaurant_id": "r1"})
    assert resp.status_code == 400


def test_discover_restaurant_not_found(client):
    resp = client.post("/api/chat/discover", json={
        "restaurant_id": "r1", "subcategory_id": "c1"
    })
    assert resp.status_code == 404


def test_discover_filters_and_scores(client, db):
    db.seed("restaurants/r1", {
        "categories": {"c1": {"id": "c1", "course_type": "main"}},
        "items": {
            "a": {"name": "A", "category_id": "c1", "item_type": "non-veg",
                  "main_ingredient": "Chicken", "cuisine": "Indian", "taste": "spicy",
                  "spice_level": 4, "priority": "high", "is_bestseller": True},
            "b": {"name": "B", "category_id": "c1", "item_type": "veg",
                  "main_ingredient": "Paneer", "cuisine": "Indian", "taste": "creamy",
                  "spice_level": 2, "priority": "medium"},                       # wrong diet
            "c": {"name": "C", "category_id": "c1", "item_type": "non-veg",
                  "main_ingredient": "Chicken", "cuisine": "Kerala", "taste": "spicy",
                  "spice_level": 3, "priority": "medium"},
            "d": {"name": "D", "category_id": "c1", "item_type": "non-veg",
                  "main_ingredient": "Fish", "cuisine": "Indian", "taste": "sour",
                  "spice_level": 3, "priority": "low"},                          # wrong ingredient
            "off": {"name": "Off", "category_id": "c1", "item_type": "non-veg",
                    "main_ingredient": "Chicken", "is_enabled": False},          # disabled
            "othercat": {"name": "Other", "category_id": "c9", "item_type": "non-veg",
                         "main_ingredient": "Chicken", "taste": "spicy"},        # wrong subcategory
        },
    })
    body = client.post("/api/chat/discover", json={
        "restaurant_id": "r1", "diet": "non-veg", "subcategory_id": "c1",
        "ingredient": "Chicken", "taste": "spicy"
    }).get_json()
    names = [s["name"] for s in body["suggestions"]]
    assert names == ["A", "C"]  # 'a' (high+bestseller+spicy) beats 'c'
    assert "top" in body["message"]


def test_discover_cuisine_others_bucket(client, db):
    db.seed("restaurants/r1", {
        "items": {
            "labeled": {"name": "Labeled", "category_id": "c1", "item_type": "veg",
                        "main_ingredient": "Paneer", "cuisine": "Indian", "taste": "creamy"},
            "plain": {"name": "Plain", "category_id": "c1", "item_type": "veg",
                      "main_ingredient": "Paneer", "taste": "creamy"},  # no cuisine -> Others
        }
    })
    body = client.post("/api/chat/discover", json={
        "restaurant_id": "r1", "diet": "veg", "subcategory_id": "c1",
        "ingredient": "any", "cuisine": "others", "taste": "creamy"
    }).get_json()
    names = [s["name"] for s in body["suggestions"]]
    assert names == ["Plain"]


def test_discover_veg_restaurant_forces_veg(client, db):
    db.seed("restaurants/r1", {
        "restaurant_type": "veg",
        "items": {
            "nv": {"name": "NV", "category_id": "c1", "item_type": "non-veg",
                   "main_ingredient": "Chicken", "taste": "spicy"},
            "v": {"name": "V", "category_id": "c1", "item_type": "veg",
                  "main_ingredient": "Paneer", "taste": "spicy"},
        }
    })
    body = client.post("/api/chat/discover", json={
        "restaurant_id": "r1", "diet": "mix", "subcategory_id": "c1",
        "ingredient": "any", "taste": "spicy"
    }).get_json()
    names = [s["name"] for s in body["suggestions"]]
    assert names == ["V"]  # non-veg excluded even though diet=mix


def test_discover_no_match_message(client, db):
    db.seed("restaurants/r1", {"items": {}})
    body = client.post("/api/chat/discover", json={
        "restaurant_id": "r1", "subcategory_id": "c1", "taste": "spicy"
    }).get_json()
    assert body["suggestions"] == []
    assert "couldn't find" in body["message"].lower()


# =============================== suggest ===============================
def test_suggest_missing_fields(client):
    resp = client.post("/api/chat/suggest", json={"current_item": {}})
    assert resp.status_code == 400


def test_suggest_restaurant_not_found(client):
    resp = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1", "current_item": {"id": "x"}
    })
    assert resp.status_code == 404


def test_suggest_admin_recommendation(client, db):
    db.seed("restaurants/r1", {
        "items": {
            "i1": {"name": "Curry", "recommendations": {
                "i2": {"priority": "high"}, "i3": {"priority": "low"}}},
            "i2": {"name": "Naan", "is_enabled": True},
            "i3": {"name": "Rice", "is_enabled": True},
        }
    })
    resp = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1", "current_item": {"id": "i1", "name": "Curry"}, "course_type": "main",
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["suggestions"][0]["name"] == "Naan"  # high priority sorts first
    assert "<b>Curry</b>" in body["message"]


def test_suggest_normalizes_legacy_recs(client, db):
    # Legacy two-bucket shape must still resolve to a flat list of companions.
    db.seed("restaurants/r1", {
        "items": {
            "i1": {"name": "Curry", "recommendations": {
                "food_items": {"i2": {"priority": "high"}},
                "beverages": {"i3": {"priority": "medium"}}}},
            "i2": {"name": "Naan", "is_enabled": True},
            "i3": {"name": "Tea", "is_enabled": True},
        }
    })
    body = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1", "current_item": {"id": "i1", "name": "Curry"},
    }).get_json()
    names = sorted(s["name"] for s in body["suggestions"])
    assert names == ["Naan", "Tea"]


def test_suggest_admin_rec_no_match_falls_back(client, db):
    # rec points at a disabled item -> no candidate -> fallback logic
    db.seed("restaurants/r1", {
        "categories": {"c1": {"id": "c1", "course_type": "main"}},
        "items": {
            "cur": {"name": "Curry", "category_id": "c1", "item_type": "non-veg",
                    "spice_level": 3, "priority": "high", "is_bestseller": True,
                    "recommendations": {"ghost": {"priority": "high"}}},
            "dry": {"name": "Dry", "category_id": "c1", "item_type": "non-veg",
                    "spice_level": 3, "priority": "medium"},
        },
    })
    body = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1",
        "current_item": {"id": "cur", "name": "Curry", "spice_level": 3, "item_type": "non-veg",
                         "category_id": "c1"},
        "course_type": "main",
    }).get_json()
    assert body["suggestions"][0]["name"] == "Dry"


def test_suggest_fallback_filters(client, db):
    db.seed("restaurants/r1", {
        "categories": {
            "c9": {"id": "c9", "course_type": "other"},
            "c1": {"id": "c1", "course_type": "main"},
        },
        "items": {
            "cur": {"name": "Curry", "category_id": "c1", "item_type": "non-veg", "spice_level": 3, "priority": "high"},
            "ok": {"name": "Ok", "category_id": "c1", "item_type": "non-veg", "spice_level": 3,
                   "priority": "medium", "is_bestseller": True},
            "veg": {"name": "Veg", "category_id": "c1", "item_type": "veg", "spice_level": 3},       # wrong type
            "off": {"name": "Off", "category_id": "c1", "item_type": "non-veg", "spice_level": 3, "is_enabled": False},
            "other": {"name": "Other", "category_id": "c9", "item_type": "non-veg", "spice_level": 3},  # wrong category
        },
    })
    body = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1",
        "current_item": {"id": "cur", "name": "Curry", "spice_level": 3, "item_type": "non-veg",
                         "category_id": "c1"},
        "course_type": "main",
    }).get_json()
    # 'ok' is the only viable candidate (bestseller bonus applied) and must win
    assert body["suggestions"][0]["name"] == "Ok"
    assert body["suggestions"][0]["score"] == 3  # medium(2) + bestseller(1)


def test_suggest_no_match_returns_empty(client, db):
    db.seed("restaurants/r1", {
        "categories": {"c1": {"id": "c1", "course_type": "main"}},
        "items": {"cur": {"name": "Curry", "category_id": "c1", "item_type": "non-veg", "spice_level": 3}},
    })
    body = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1",
        "current_item": {"id": "cur", "name": "Curry", "spice_level": 3, "item_type": "non-veg",
                         "category_id": "c1"},
        "course_type": "main",
    }).get_json()
    assert body["suggestions"] == []
    assert body["message"] == ""
