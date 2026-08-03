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
    # No top-N cap: all matching items returned, sorted by priority (A high, C medium).
    assert names == ["A", "C"]
    assert body["message"]  # non-empty success message


def test_discover_returns_all_no_cap(client, db):
    # Five spicy chicken non-veg items must ALL come back (priority order).
    db.seed("restaurants/r1", {
        "items": {f"i{n}": {"name": f"N{n}", "category_id": "c1", "item_type": "non-veg",
                            "main_ingredient": "Chicken", "taste": "spicy",
                            "priority": "low" if n == 0 else "high"}
                  for n in range(5)},
    })
    body = client.post("/api/chat/discover", json={
        "restaurant_id": "r1", "diet": "non-veg", "subcategory_id": "c1",
        "ingredient": "Chicken", "taste": "spicy"
    }).get_json()
    names = [s["name"] for s in body["suggestions"]]
    assert len(names) == 5
    # priority high sorts before low (N1..N4 high, N0 low)
    assert names[-1] == "N0"


def test_discover_main_category_filter(client, db):
    db.seed("restaurants/r1", {
        "items": {
            "a": {"name": "A", "category_id": "c1", "main_category_id": "mc1",
                  "item_type": "veg", "main_ingredient": "Paneer", "taste": "spicy"},
            "b": {"name": "B", "category_id": "c2", "main_category_id": "mc2",
                  "item_type": "veg", "main_ingredient": "Paneer", "taste": "spicy"},
        },
    })
    body = client.post("/api/chat/discover", json={
        "restaurant_id": "r1", "diet": "veg", "main_category_id": "mc1",
        "subcategory_id": "c1", "ingredient": "any", "taste": "spicy"
    }).get_json()
    assert [s["name"] for s in body["suggestions"]] == ["A"]


def test_discover_taste_contains_match(client, db):
    # v2 semantics: taste is multi-select on items, single-select contains filter.
    db.seed("restaurants/r1", {
        "items": {
            "multi": {"name": "Multi", "category_id": "c1", "item_type": "veg",
                      "main_ingredient": "Paneer", "taste": ["spicy", "sweet"]},
            "legacy": {"name": "Legacy", "category_id": "c1", "item_type": "veg",
                       "main_ingredient": "Paneer", "taste": "spicy"},  # legacy string
            "nomatch": {"name": "NoMatch", "category_id": "c1", "item_type": "veg",
                        "main_ingredient": "Paneer", "taste": ["sour"]},
        },
    })
    # picking 'spicy' keeps items whose taste list contains it (case-insensitive)
    body = client.post("/api/chat/discover", json={
        "restaurant_id": "r1", "diet": "veg", "subcategory_id": "c1",
        "ingredient": "any", "taste": "SPICY"
    }).get_json()
    names = sorted(s["name"] for s in body["suggestions"])
    assert names == ["Legacy", "Multi"]  # both contain 'spicy'; NoMatch excluded


def test_discover_empty_taste_is_no_filter(client, db):
    db.seed("restaurants/r1", {
        "items": {
            "a": {"name": "A", "category_id": "c1", "item_type": "veg",
                  "main_ingredient": "Paneer", "taste": ["spicy"]},
            "b": {"name": "B", "category_id": "c1", "item_type": "veg",
                  "main_ingredient": "Paneer", "taste": ["sweet"]},
        },
    })
    body = client.post("/api/chat/discover", json={
        "restaurant_id": "r1", "diet": "veg", "subcategory_id": "c1",
        "ingredient": "any", "taste": ""
    }).get_json()
    assert sorted(s["name"] for s in body["suggestions"]) == ["A", "B"]


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


def test_discover_cuisine_any_is_no_filter(client, db):
    # The chat's "Any" cuisine choice sends cuisine='any'. It must NOT be
    # treated as a literal cuisine name — items with no cuisine must still match.
    db.seed("restaurants/r1", {
        "items": {
            "a": {"name": "A", "category_id": "c1", "main_category_id": "mc1",
                  "item_type": "non-veg", "main_ingredient": "Chicken",
                  "cuisine": "", "taste": ["spicy"], "priority": "high"},
        },
    })
    body = client.post("/api/chat/discover", json={
        "restaurant_id": "r1", "diet": "non-veg", "cuisine": "any",
        "main_category_id": "mc1", "subcategory_id": "c1",
        "ingredient": "Chicken", "taste": "spicy"
    }).get_json()
    assert [s["name"] for s in body["suggestions"]] == ["A"]

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


def test_suggest_returns_all_recommendations_no_cap(client, db):
    # More than 3 admin-defined companions must all come back (cap removed).
    recs = {f"i{n}": {"priority": "low"} for n in range(5)}
    recs["i0"] = {"priority": "high"}
    items = {"cur": {"name": "Curry", "recommendations": recs}}
    for n in range(5):
        items[f"i{n}"] = {"name": f"N{n}", "is_enabled": True}
    db.seed("restaurants/r1", {"items": items})
    body = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1", "current_item": {"id": "cur", "name": "Curry"},
    }).get_json()
    names = [s["name"] for s in body["suggestions"]]
    assert len(names) == 5
    # sorted by priority: the high-priority one first
    assert names[0] == "N0"


def test_suggest_admin_recs_ignore_diet(client, db):
    # Owner-curated companions are shown regardless of the guest's diet — a
    # non-veg guest buying a main should still see a curated veg side.
    db.seed("restaurants/r1", {
        "items": {
            "cur": {"name": "Biryani", "recommendations": {
                "side": {"priority": "high"}, "curry": {"priority": "medium"}}},
            "side": {"name": "Raita", "is_enabled": True, "item_type": "veg"},
            "curry": {"name": "Curry", "is_enabled": True, "item_type": "non-veg"},
        }
    })
    body = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1", "current_item": {"id": "cur", "name": "Biryani"},
        "diet": "non-veg",
    }).get_json()
    names = sorted(s["name"] for s in body["suggestions"])
    assert names == ["Curry", "Raita"]  # both, including the veg side


def test_suggest_fallback_taste_overlap(client, db):
    # Fallback scoring rewards shared tastes (list contains match).
    db.seed("restaurants/r1", {
        "categories": {"c1": {"id": "c1"}},
        "items": {
            "cur": {"name": "Curry", "category_id": "c1", "item_type": "non-veg",
                    "taste": ["spicy", "sweet"], "priority": "medium"},
            "share": {"name": "Share", "category_id": "c1", "item_type": "non-veg",
                      "taste": ["spicy"], "priority": "medium"},      # +1 taste overlap
            "diff": {"name": "Diff", "category_id": "c1", "item_type": "non-veg",
                     "taste": ["sour"], "priority": "medium"},
        },
    })
    body = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1",
        "current_item": {"id": "cur", "name": "Curry", "category_id": "c1",
                         "item_type": "non-veg", "taste": ["spicy", "sweet"]},
    }).get_json()
    by_name = {s["name"]: s for s in body["suggestions"]}
    # Share gets medium(2)+taste(1)=3; Diff gets medium(2) only
    assert by_name["Share"]["score"] == 3
    assert by_name["Diff"]["score"] == 2
    assert body["suggestions"][0]["name"] == "Share"
