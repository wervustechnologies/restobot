"""Tests for routes/wishlist.py (wishlists + draft carts)."""


def test_format_list_helper():
    # format_list is defined in wishlist.py but not used by any endpoint yet;
    # exercise it directly to lock its behavior.
    from routes.wishlist import format_list
    assert format_list(None) == []
    assert format_list({}) == []
    assert format_list({"a": {"x": 1}}) == [{"id": "a", "x": 1}]


# ----------------------------- save_wishlist --------------------------
def test_save_wishlist_missing_fields(client):
    resp = client.post("/api/wishlist", json={"restaurant_id": "r1"})
    assert resp.status_code == 400


def test_save_wishlist_unknown_table(client, db):
    resp = client.post("/api/wishlist", json={
        "restaurant_id": "r1", "items": [{"name": "A"}], "qr_token": "none", "total_amount": 5,
    })
    assert resp.status_code == 201
    body = resp.get_json()
    wid = body["wishlist_id"]
    saved = db.read(f"restaurants/r1/wishlists/{wid}")
    assert saved["table_number"] == "Unknown"
    assert saved["type"] == "wishlist"
    assert saved["total_amount"] == 5


def test_save_wishlist_without_qr_token(client, db):
    resp = client.post("/api/wishlist", json={"restaurant_id": "r1", "items": [{"name": "A"}]})
    assert resp.status_code == 201
    wid = resp.get_json()["wishlist_id"]
    assert db.read(f"restaurants/r1/wishlists/{wid}/table_number") == "Unknown"


def test_save_wishlist_resolves_table(client, db):
    db.seed("table_tokens/tok", {"table_number": "4"})
    resp = client.post("/api/wishlist", json={
        "restaurant_id": "r1", "items": [{"name": "A"}], "qr_token": "tok",
    })
    wid = resp.get_json()["wishlist_id"]
    assert db.read(f"restaurants/r1/wishlists/{wid}/table_number") == "4"


# ------------------------- mark_wishlist_ordered ----------------------
def test_mark_wishlist_ordered_not_found(client):
    resp = client.put("/api/wishlist/r1/ghost/ordered")
    assert resp.status_code == 404


def test_mark_wishlist_ordered_success(client, db):
    db.seed("restaurants/r1/wishlists/w1", {"items": [], "type": "wishlist"})
    resp = client.put("/api/wishlist/r1/w1/ordered")
    assert resp.status_code == 200
    assert db.read("restaurants/r1/wishlists/w1/ordered") is True
    assert db.read("restaurants/r1/wishlists/w1/ordered_at") is not None


# ----------------------------- get_wishlist ---------------------------
def test_get_wishlist_not_found(client):
    resp = client.get("/api/wishlist/r1/ghost")
    assert resp.status_code == 404


def test_get_wishlist_found(client, db):
    db.seed("restaurants/r1/wishlists/w1", {"items": [{"name": "A"}]})
    resp = client.get("/api/wishlist/r1/w1")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["id"] == "w1"
    assert body["items"][0]["name"] == "A"


# --------------------------- save_draft_cart -------------------------
def test_save_draft_cart_missing(client):
    resp = client.post("/api/cart", json={"restaurant_id": "r1"})
    assert resp.status_code == 400


def test_save_draft_cart_success(client, db):
    resp = client.post("/api/cart", json={
        "restaurant_id": "r1", "guest_id": "g1", "cart": {"items": ["x"]},
    })
    assert resp.status_code == 200
    assert db.read("restaurants/r1/active_carts/g1") == {"items": ["x"]}


# --------------------------- get_draft_cart ---------------------------
def test_get_draft_cart_empty(client):
    resp = client.get("/api/cart/r1/g1")
    assert resp.status_code == 200
    assert resp.get_json() == {}


def test_get_draft_cart_found(client, db):
    db.seed("restaurants/r1/active_carts/g1", {"items": ["x", "y"]})
    resp = client.get("/api/cart/r1/g1")
    assert resp.get_json() == {"items": ["x", "y"]}
