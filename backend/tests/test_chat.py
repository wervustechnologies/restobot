"""Tests for routes/chat.py (AI suggestion + meal evaluation logic)."""


# =============================== suggest ===============================
def test_suggest_missing_fields(client):
    resp = client.post("/api/chat/suggest", json={"current_item": {}})
    assert resp.status_code == 400


def test_suggest_restaurant_not_found(client):
    resp = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1", "current_item": {"id": "x"}
    })
    assert resp.status_code == 404


def test_suggest_admin_food_recommendation(client, db):
    db.seed("restaurants/r1", {
        "items": {
            "i1": {"name": "Curry", "recommendations": {
                "food_items": {"i2": {"priority": "high"}, "i3": {"priority": "low"}}}},
            "i2": {"name": "Naan", "is_enabled": True},
            "i3": {"name": "Rice", "is_enabled": True},
        }
    })
    resp = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1", "current_item": {"id": "i1", "name": "Curry"}, "course_type": "main",
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["suggestion"]["name"] == "Naan"  # high priority wins
    assert "<b>Naan</b>" in body["message"]


def test_suggest_admin_rec_no_match_falls_back(client, db):
    # food rec points at a disabled item -> no candidate -> fallback logic
    db.seed("restaurants/r1", {
        "categories": {"c1": {"id": "c1", "course_type": "main"}},
        "items": {
            "cur": {"name": "Curry", "category_id": "c1", "item_type": "non-veg",
                    "spice_level": 3, "priority": "high", "is_bestseller": True,
                    "recommendations": {"food_items": {"ghost": {"priority": "high"}}}},
            "dry": {"name": "Dry", "category_id": "c1", "item_type": "non-veg", "spice_level": 3, "priority": "medium"},
        },
    })
    body = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1",
        "current_item": {"id": "cur", "name": "Curry", "spice_level": 3, "item_type": "non-veg"},
        "course_type": "main",
    }).get_json()
    assert body["suggestion"]["name"] == "Dry"


def test_suggest_fallback_filters(client, db):
    db.seed("restaurants/r1", {
        # 'c9' (non-matching course) is inserted FIRST so the category loop
        # iterates a non-match before finding 'c1'.
        "categories": {
            "c9": {"id": "c9", "course_type": "other"},
            "c1": {"id": "c1", "course_type": "main"},
        },
        "items": {
            "cur": {"name": "Curry", "category_id": "c1", "item_type": "non-veg", "spice_level": 3, "priority": "high"},
            "ok": {"name": "Ok", "category_id": "c1", "item_type": "non-veg", "spice_level": 3,
                   "priority": "medium", "is_bestseller": True},
            "veg": {"name": "Veg", "category_id": "c1", "item_type": "veg", "spice_level": 3},       # wrong type
            "far": {"name": "Far", "category_id": "c1", "item_type": "non-veg", "spice_level": 5},    # spice diff 2
            "off": {"name": "Off", "category_id": "c1", "item_type": "non-veg", "spice_level": 3, "is_enabled": False},
            "other": {"name": "Other", "category_id": "c9", "item_type": "non-veg", "spice_level": 3},  # wrong category
        },
    })
    body = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1",
        "current_item": {"id": "cur", "name": "Curry", "spice_level": 3, "item_type": "non-veg"},
        "course_type": "main",
    }).get_json()
    # 'ok' is the only viable candidate (bestseller bonus applied) and must win
    assert body["suggestion"]["name"] == "Ok"
    assert body["suggestion"]["score"] == 3  # medium(2) + bestseller(1)
    assert body["suggestion"]["name"] != "Off"


def test_suggest_unmatched_course_type(client, db):
    # course_type matches no category -> category loop exhausts (current_cat_id None)
    # -> every item's category_id != None -> no suggestions
    db.seed("restaurants/r1", {
        "categories": {"c1": {"id": "c1", "course_type": "main"}},
        "items": {"a": {"name": "A", "category_id": "c1", "item_type": "non-veg", "spice_level": 3}},
    })
    body = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1",
        "current_item": {"id": "a", "name": "A", "spice_level": 3, "item_type": "non-veg"},
        "course_type": "dessert",
    }).get_json()
    assert body["suggestion"] is None


def test_suggest_no_match_returns_none(client, db):
    db.seed("restaurants/r1", {
        "categories": {"c1": {"id": "c1", "course_type": "main"}},
        "items": {"cur": {"name": "Curry", "category_id": "c1", "item_type": "non-veg", "spice_level": 3}},
    })
    body = client.post("/api/chat/suggest", json={
        "restaurant_id": "r1",
        "current_item": {"id": "cur", "name": "Curry", "spice_level": 3, "item_type": "non-veg"},
        "course_type": "main",
    }).get_json()
    assert body["suggestion"] is None
    assert body["message"] == ""


# ============================== evaluate ===============================
def test_evaluate_missing_restaurant(client):
    resp = client.post("/api/chat/evaluate", json={"selections": {}})
    assert resp.status_code == 400


def test_evaluate_restaurant_not_found(client):
    resp = client.post("/api/chat/evaluate", json={"restaurant_id": "r1"})
    assert resp.status_code == 404


def test_evaluate_no_selections(client, db):
    db.seed("restaurants/r1", {"items": {}})
    body = client.post("/api/chat/evaluate", json={
        "restaurant_id": "r1", "selections": {"s1": None, "s2": {}}
    }).get_json()
    assert body["suggestion"] is None
    assert body["suggestion_text"] == ""


def test_evaluate_beverage_recommendation(client, db):
    db.seed("restaurants/r1", {
        "items": {
            "m1": {"name": "Main1", "recommendations": {"beverages": {
                # 'ghost' is listed first and has no matching active item -> match
                # None -> inner loop continues; then 'b1' matches.
                "ghost": {"priority": "high"},
                "b1": {"priority": "high"},
            }}},
            "b1": {"name": "Coke", "is_enabled": True},
        }
    })
    body = client.post("/api/chat/evaluate", json={
        "restaurant_id": "r1", "selections": {"s1": {"id": "m1", "name": "Main1"}},
    }).get_json()
    assert body["suggestion"]["name"] == "Coke"
    assert "<b>Coke</b>" in body["suggestion_text"]


def test_evaluate_beverage_skips_already_selected(client, db):
    # rec points at an item the user already selected -> ignored, falls to fallback
    db.seed("restaurants/r1", {
        "categories": {"bevs": {"id": "bevs", "course_type": "beverage"}},
        "items": {
            "m1": {"name": "Main1", "item_type": "non-veg", "category_id": "mainx",
                   "recommendations": {"beverages": {"b1": {"priority": "high"}}}},
            "b1": {"name": "Coke", "is_enabled": True, "category_id": "bevs", "item_type": "non-veg", "priority": "low"},
        },
    })
    body = client.post("/api/chat/evaluate", json={
        "restaurant_id": "r1",
        "selections": {"s1": {"id": "m1", "name": "Main1", "item_type": "non-veg", "category_id": "mainx"},
                       "s2": {"id": "b1", "name": "Coke", "item_type": "non-veg", "category_id": "bevs"}},
    }).get_json()
    # b1 already selected -> no beverage candidate, fallback also finds nothing
    assert body["suggestion"] is None


def test_evaluate_fallback_excludes_same_course(client, db):
    db.seed("restaurants/r1", {
        "categories": {
            "main": {"id": "main", "course_type": "main"},
            "bevs": {"id": "bevs", "course_type": "beverage"},
        },
        "items": {
            "m1": {"name": "M1", "category_id": "main", "item_type": "non-veg", "priority": "medium"},
            "cand": {"name": "Cand", "category_id": "bevs", "item_type": "non-veg",
                     "priority": "high", "is_bestseller": True},
            "wc": {"name": "WC", "category_id": "main", "item_type": "non-veg"},  # same course -> excluded
            # category_id references no category -> inner category loop exhausts
            "orphan": {"name": "Orphan", "category_id": "unknowncat", "item_type": "non-veg", "priority": "low"},
        },
    })
    body = client.post("/api/chat/evaluate", json={
        "restaurant_id": "r1",
        "selections": {"s1": {"id": "m1", "name": "M1", "item_type": "non-veg", "category_id": "main"}},
    }).get_json()
    assert body["suggestion"]["name"] == "Cand"


def test_evaluate_prefers_veg_when_all_veg(client, db):
    db.seed("restaurants/r1", {
        "categories": {"bevs": {"id": "bevs", "course_type": "beverage"}},
        "items": {
            "veg_main": {"name": "VM", "category_id": "mainx", "item_type": "veg"},
            "veg_drink": {"name": "VD", "category_id": "bevs", "item_type": "veg", "priority": "high"},
            "nv_drink": {"name": "ND", "category_id": "bevs", "item_type": "non-veg", "priority": "high"},
        },
    })
    body = client.post("/api/chat/evaluate", json={
        "restaurant_id": "r1",
        "selections": {"s1": {"id": "veg_main", "name": "VM", "item_type": "veg", "category_id": "mainx"}},
    }).get_json()
    # preferred_type veg -> ND (non-veg) excluded
    assert body["suggestion"]["name"] == "VD"


def test_evaluate_no_candidate(client, db):
    db.seed("restaurants/r1", {
        "categories": {"main": {"id": "main", "course_type": "main"}},
        "items": {"m1": {"name": "M1", "category_id": "main", "item_type": "non-veg"}},
    })
    body = client.post("/api/chat/evaluate", json={
        "restaurant_id": "r1",
        "selections": {"s1": {"id": "m1", "name": "M1", "item_type": "non-veg", "category_id": "main"}},
    }).get_json()
    assert body["suggestion"] is None
