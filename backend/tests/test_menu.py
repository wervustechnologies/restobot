def _restaurant(db):
    db.seed("restaurants/r1", {
        "name": "Resto",
        "address": "123 St",
        "review_link": "http://rev",
        "main_categories": {
            "mc1": {"name": "Mains", "display_order": 2},
            "mc0": {"name": "Starters", "display_order": 1},
        },
        "categories": {
            "c0": {"name": "Starters A", "main_category_id": "mc0", "display_order": 1, "course_type": "starter"},
            "c1": {"name": "Mains A", "main_category_id": "mc1", "display_order": 2, "course_type": "main"},
            "legacy": {"name": "Legacy Cat", "display_order": 0},  # no main_category_id
        },
        "items": {
            "i_high": {"name": "Hi", "category_id": "c1", "priority": "high", "price": 10},
            "i_low": {"name": "Lo", "category_id": "c1", "priority": "low", "price": 5},
            "i_med": {"name": "Md", "category_id": "c1", "priority": "medium", "price": 7},
            "i_unknown": {"name": "Un", "category_id": "c1", "price": 3},  # unknown priority -> medium
            "i_leg": {"name": "LegItem", "category_id": "legacy", "price": 2},
        },
    })


def test_get_menu_restaurant_not_found(client):
    resp = client.get("/api/menu/missing")
    assert resp.status_code == 404


def test_get_menu_structure_and_sorting(client, db):
    _restaurant(db)
    resp = client.get("/api/menu/r1")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["restaurant"]["name"] == "Resto"
    assert body["restaurant"]["review_link"] == "http://rev"
    # main_categories sorted by display_order: Starters(mc0) then Mains(mc1)
    mains = body["main_categories"]
    assert [m["name"] for m in mains[:2]] == ["Starters", "Mains"]
    # within Mains (mc1) -> category c1, items sorted high>medium(=unknown)>low
    mc_mains = next(m for m in mains if m["id"] == "mc1")
    c1 = mc_mains["categories"][0]
    names = [i["name"] for i in c1["items"]]
    assert names[0] == "Hi"          # high first
    assert names[-1] == "Lo"         # low last
    # 'Md' and 'Un' both medium -> present after high, before low
    assert set(names[1:3]) == {"Md", "Un"}


def test_get_menu_legacy_other_bucket(client, db):
    _restaurant(db)
    body = client.get("/api/menu/r1").get_json()
    other = next(m for m in body["main_categories"] if m["id"] == "legacy-other")
    assert other["name"] == "Other"
    assert [i["name"] for i in other["categories"][0]["items"]] == ["LegItem"]


def test_get_menu_empty_collections(client, db):
    db.seed("restaurants/r1", {"name": "Empty"})
    body = client.get("/api/menu/r1").get_json()
    assert body["main_categories"] == []
    assert body["restaurant"]["review_link"] == ""


# --------------------------- recommend ---------------------------------
def test_recommend_scoring(client, db):
    db.seed("restaurants/r1", {
        "items": {
            "a": {"name": "A", "item_type": "veg", "spice_level": 3, "heaviness": "light", "is_bestseller": True},
            "b": {"name": "B", "item_type": "non-veg", "spice_level": 3, "heaviness": "heavy"},
            "c": {"name": "C", "item_type": "veg", "spice_level": 1, "heaviness": "light"},
            "d": {"name": "D", "item_type": "veg", "spice_level": 3, "heaviness": "light"},
        }
    })
    prefs = {"item_type": "veg", "spice_level": 3, "heaviness": "light"}
    resp = client.post("/api/menu/r1/recommend", json=prefs)
    assert resp.status_code == 200
    recs = resp.get_json()
    assert len(recs) == 3
    # A matches type(+5), spice<=1(+3), heaviness(+2), bestseller(+2) = 12 -> top
    assert recs[0]["name"] == "A"
    assert recs[0]["match_score"] == 12
    # C has spice diff 2 -> no spice point; type+5, heaviness+2 = 7
    c = next(r for r in recs if r["name"] == "C")
    assert c["match_score"] == 7


def test_recommend_missing_defaults(client, db):
    # prefs without optional fields; spice_level defaults to 3
    db.seed("restaurants/r1", {
        "items": {"a": {"name": "A", "item_type": "veg"}}
    })
    recs = client.post("/api/menu/r1/recommend", json={}).get_json()
    assert len(recs) == 1
    assert recs[0]["name"] == "A"


def test_recommend_returns_top_three(client, db):
    db.seed("restaurants/r1", {
        "items": {
            f"i{n}": {"name": f"N{n}", "item_type": "veg", "spice_level": 3, "heaviness": "light"}
            for n in range(6)
        }
    })
    recs = client.post("/api/menu/r1/recommend", json={"item_type": "veg", "spice_level": 3, "heaviness": "light"}).get_json()
    assert len(recs) == 3
