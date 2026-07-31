# ------------------------- restaurant settings ------------------------
def test_get_restaurant(client, db, auth_headers):
    db.seed("restaurants/r1", {"name": "R", "address": "St"})
    resp = client.get("/api/admin/restaurant", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["name"] == "R"


def test_update_restaurant(client, db, auth_headers):
    resp = client.put("/api/admin/restaurant", json={"name": "New"}, headers=auth_headers)
    assert resp.status_code == 200
    assert db.read("restaurants/r1/name") == "New"


# --------------------------- main categories --------------------------
def test_main_categories_sorted(client, db, auth_headers):
    db.seed("restaurants/r1/main_categories", {
        "a": {"name": "A", "display_order": 2},
        "b": {"name": "B", "display_order": 1},
    })
    resp = client.get("/api/admin/main_categories", headers=auth_headers)
    assert [c["name"] for c in resp.get_json()] == ["B", "A"]


def test_add_main_category(client, auth_headers):
    resp = client.post("/api/admin/main_categories", json={"name": "X", "display_order": 1}, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["id"]
    assert body["name"] == "X"


def test_delete_main_category(client, db, auth_headers):
    db.seed("restaurants/r1/main_categories/a", {"name": "A"})
    resp = client.delete("/api/admin/main_categories/a", headers=auth_headers)
    assert resp.status_code == 200
    assert db.read("restaurants/r1/main_categories/a") is None


# ------------------------------ categories ----------------------------
def test_categories_sorted(client, db, auth_headers):
    db.seed("restaurants/r1/categories", {
        "a": {"name": "A", "display_order": 2},
        "b": {"name": "B", "display_order": 1},
    })
    resp = client.get("/api/admin/categories", headers=auth_headers)
    assert [c["name"] for c in resp.get_json()] == ["B", "A"]


def test_add_and_delete_category(client, db, auth_headers):
    resp = client.post("/api/admin/categories", json={"name": "C"}, headers=auth_headers)
    assert resp.status_code == 201
    cid = resp.get_json()["id"]
    assert db.read(f"restaurants/r1/categories/{cid}")["name"] == "C"
    assert client.delete(f"/api/admin/categories/{cid}", headers=auth_headers).status_code == 200
    assert db.read(f"restaurants/r1/categories/{cid}") is None


# ----------------------------- ingredients ----------------------------
def test_ingredients_sorted(client, db, auth_headers):
    db.seed("restaurants/r1/ingredients", {
        "a": {"name": "Chicken", "display_order": 2},
        "b": {"name": "Paneer", "display_order": 1},
    })
    resp = client.get("/api/admin/ingredients", headers=auth_headers)
    assert [i["name"] for i in resp.get_json()] == ["Paneer", "Chicken"]


def test_add_update_delete_ingredient(client, auth_headers, db):
    resp = client.post("/api/admin/ingredients", json={"name": "Tofu", "display_order": 1}, headers=auth_headers)
    assert resp.status_code == 201
    iid = resp.get_json()["id"]
    assert db.read(f"restaurants/r1/ingredients/{iid}")["name"] == "Tofu"

    assert client.put(f"/api/admin/ingredients/{iid}", json={"name": "Soya"}, headers=auth_headers).status_code == 200
    assert db.read(f"restaurants/r1/ingredients/{iid}")["name"] == "Soya"

    assert client.delete(f"/api/admin/ingredients/{iid}", headers=auth_headers).status_code == 200
    assert db.read(f"restaurants/r1/ingredients/{iid}") is None


# ------------------------------ cuisines ------------------------------
def test_cuisines_sorted(client, db, auth_headers):
    db.seed("restaurants/r1/cuisines", {
        "a": {"name": "Indian", "display_order": 2},
        "b": {"name": "Kerala", "display_order": 1},
    })
    resp = client.get("/api/admin/cuisines", headers=auth_headers)
    assert [c["name"] for c in resp.get_json()] == ["Kerala", "Indian"]


def test_add_and_delete_cuisine(client, auth_headers, db):
    resp = client.post("/api/admin/cuisines", json={"name": "Chinese", "display_order": 1}, headers=auth_headers)
    assert resp.status_code == 201
    cid = resp.get_json()["id"]
    assert db.read(f"restaurants/r1/cuisines/{cid}")["name"] == "Chinese"
    assert client.delete(f"/api/admin/cuisines/{cid}", headers=auth_headers).status_code == 200
    assert db.read(f"restaurants/r1/cuisines/{cid}") is None


# -------------------------------- items -------------------------------
def test_get_items(client, db, auth_headers):
    db.seed("restaurants/r1/items", {"i1": {"name": "Item1", "price": 5}})
    resp = client.get("/api/admin/items", headers=auth_headers)
    assert resp.get_json()[0]["name"] == "Item1"


def test_get_items_empty_returns_empty_list(client, auth_headers):
    resp = client.get("/api/admin/items", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_add_item(client, auth_headers):
    resp = client.post("/api/admin/items", json={"name": "New", "price": 9}, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.get_json()["name"] == "New"


def test_update_item_echoes_data(client, db, auth_headers):
    resp = client.put("/api/admin/items/i1", json={"price": 99}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["id"] == "i1"
    assert body["data"]["price"] == 99
    assert db.read("restaurants/r1/items/i1/price") == 99


def test_delete_item(client, db, auth_headers):
    db.seed("restaurants/r1/items/i1", {"name": "X"})
    assert client.delete("/api/admin/items/i1", headers=auth_headers).status_code == 200
    assert db.read("restaurants/r1/items/i1") is None


# --------------------------- recommendations --------------------------
def test_get_recommendations_default(client, db, auth_headers):
    db.seed("restaurants/r1/items/i1", {"name": "X"})
    resp = client.get("/api/admin/items/i1/recommendations", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json() == {"food_items": {}, "beverages": {}}


def test_get_recommendations_existing(client, db, auth_headers):
    db.seed("restaurants/r1/items/i1/recommendations", {"food_items": {"a": {"priority": "high"}}})
    resp = client.get("/api/admin/items/i1/recommendations", headers=auth_headers)
    assert resp.get_json()["food_items"]["a"]["priority"] == "high"


def test_update_recommendations_uses_set(client, db, auth_headers):
    db.seed("restaurants/r1/items/i1/recommendations", {"old": "data"})
    resp = client.put("/api/admin/items/i1/recommendations",
                      json={"food_items": {"a": {"priority": "medium"}}}, headers=auth_headers)
    assert resp.status_code == 200
    stored = db.read("restaurants/r1/items/i1/recommendations")
    assert stored == {"food_items": {"a": {"priority": "medium"}}}  # set replaces, not merges


# ------------------------------- tables -------------------------------
def test_get_tables(client, db, auth_headers):
    db.seed("restaurants/r1/tables", {"t1": {"table_number": "1"}})
    resp = client.get("/api/admin/tables", headers=auth_headers)
    assert resp.get_json()[0]["id"] == "t1"


def test_add_table_duplicate_rejected(client, db, auth_headers):
    db.seed("restaurants/r1/tables", {
        "t1": {"table_number": "1", "qr_token": "x"},
        "t2": {"table_number": "2", "qr_token": "y"},
    })
    # duplicate matches the SECOND table -> exercises loop continuation
    resp = client.post("/api/admin/tables", json={"table_number": "2"}, headers=auth_headers)
    assert resp.status_code == 409


def test_add_table_success(client, db, auth_headers):
    resp = client.post("/api/admin/tables", json={"table_number": "7"}, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["table_number"] == "7"
    assert body["qr_token"]
    assert body["id"]


def test_add_table_creates_global_token(client, db, auth_headers):
    resp = client.post("/api/admin/tables", json={"table_number": "8"}, headers=auth_headers)
    token = resp.get_json()["qr_token"]
    assert db.read(f"table_tokens/{token}/restaurant_id") == "r1"


def test_delete_table_cascades_orders(client, db, auth_headers):
    db.seed("restaurants/r1/tables/t1", {"table_number": "5", "qr_token": "tok"})
    db.seed("table_tokens/tok", {"restaurant_id": "r1", "table_number": "5"})
    db.seed("restaurants/r1/orders", {
        "o1": {"table_number": "5"},
        "o2": {"table_number": "9"},  # different table, must survive
    })
    resp = client.delete("/api/admin/tables/t1", headers=auth_headers)
    assert resp.status_code == 200
    assert db.read("restaurants/r1/tables/t1") is None
    assert db.read("table_tokens/tok") is None
    assert db.read("restaurants/r1/orders/o1") is None
    assert db.read("restaurants/r1/orders/o2") is not None


def test_delete_table_when_missing(client, auth_headers):
    resp = client.delete("/api/admin/tables/ghost", headers=auth_headers)
    assert resp.status_code == 200


def test_delete_table_without_orders(client, db, auth_headers):
    db.seed("restaurants/r1/tables/t1", {"table_number": "5", "qr_token": "tok"})
    resp = client.delete("/api/admin/tables/t1", headers=auth_headers)
    assert resp.status_code == 200
    assert db.read("restaurants/r1/tables/t1") is None


# ----------------------------- server-info ----------------------------
def test_server_info(client, auth_headers):
    resp = client.get("/api/admin/server-info", headers=auth_headers)
    assert resp.status_code == 200
    assert "local_ip" in resp.get_json()


def test_server_info_fallback_ip(monkeypatch, client, auth_headers):
    class _BadSocket:
        def __init__(self, *a, **k):
            pass

        def connect(self, *a, **k):
            raise OSError("no network")

        def getsockname(self):
            return ("x",)

        def close(self):
            pass

    monkeypatch.setattr("routes.admin.socket.socket", _BadSocket)
    resp = client.get("/api/admin/server-info", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["local_ip"] == "127.0.0.1"
