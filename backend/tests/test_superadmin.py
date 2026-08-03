"""Tests for routes/superadmin.py."""
import bcrypt

from routes import superadmin as sa


def hash_pw(pw):
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# -------------------------------- login -------------------------------
def test_superadmin_wrong_email(client):
    resp = client.post("/api/superadmin/login", json={"email": "wrong@x.com", "password": "x"})
    assert resp.status_code == 403
    assert resp.get_json()["message"].startswith("Access Denied")


def test_superadmin_wrong_password(client, monkeypatch):
    monkeypatch.setattr(sa, "SUPERADMIN_HASH", hash_pw("realpw").encode("utf-8"))
    resp = client.post("/api/superadmin/login", json={
        "email": sa.SUPERADMIN_EMAIL, "password": "wrongpw"})
    assert resp.status_code == 401


def test_superadmin_login_success(client, monkeypatch):
    monkeypatch.setattr(sa, "SUPERADMIN_HASH", hash_pw("realpw").encode("utf-8"))
    resp = client.post("/api/superadmin/login", json={
        "email": sa.SUPERADMIN_EMAIL, "password": "realpw"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["role"] == "superadmin"
    assert body["token"]


# --------------------------- list_restaurants -------------------------
def test_list_restaurants_with_and_without_admin(client, db, auth_headers):
    db.seed("restaurants/r1", {"name": "R1", "created_at": 1})
    db.seed("restaurants/r2", {"name": "R2", "created_at": 2})
    db.seed("users/u1", {"restaurant_id": "r1", "name": "Owner1", "email": "o1@x.com", "created_at": 1})

    resp = client.get("/api/superadmin/restaurants", headers=auth_headers)
    assert resp.status_code == 200
    rows = {r["rid"]: r for r in resp.get_json()}
    assert rows["r1"]["admin"]["email"] == "o1@x.com"
    assert rows["r2"]["admin"] is None  # no admin user


# ----------------------- create_restaurant_admin ----------------------
def test_create_restaurant_missing_fields(client, auth_headers):
    resp = client.post("/api/superadmin/create-restaurant", json={"restaurant_name": "X"}, headers=auth_headers)
    assert resp.status_code == 400


def test_create_restaurant_email_exists(client, db, auth_headers):
    db.seed("users/u1", {"email": "dup@x.com"})
    resp = client.post("/api/superadmin/create-restaurant", json={
        "restaurant_name": "R", "owner_name": "O", "email": "dup@x.com", "password": "p"
    }, headers=auth_headers)
    assert resp.status_code == 400


def test_create_restaurant_success(client, db, auth_headers):
    resp = client.post("/api/superadmin/create-restaurant", json={
        "restaurant_name": "New Resto", "owner_name": "Owner", "email": "new@x.com", "password": "secret"
    }, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.get_json()
    rid = body["rid"]
    assert body["admin_password"] == "secret"
    assert db.read(f"restaurants/{rid}/name") == "New Resto"
    # owner user created with hashed password
    users = db.read("users") or {}
    owner = next(u for u in users.values() if u.get("email") == "new@x.com")
    assert owner["role"] == "owner"
    assert owner["restaurant_id"] == rid
    assert owner["password"] != "secret"


def test_create_restaurant_rejects_bad_type(client, db, auth_headers):
    resp = client.post("/api/superadmin/create-restaurant", json={
        "restaurant_name": "R", "owner_name": "O", "email": "t@x.com", "password": "p",
        "restaurant_type": "bogus",
    }, headers=auth_headers)
    assert resp.status_code == 400


def test_create_restaurant_does_not_seed_ingredients(client, db, auth_headers):
    # Auto-seed of default ingredients was removed; owners add their own
    # ingredient vocabulary via the Menu Setup panel.
    resp = client.post("/api/superadmin/create-restaurant", json={
        "restaurant_name": "Veg House", "owner_name": "Owner", "email": "veg@x.com",
        "password": "secret", "restaurant_type": "veg",
    }, headers=auth_headers)
    assert resp.status_code == 201
    rid = resp.get_json()["rid"]
    assert db.read(f"restaurants/{rid}/restaurant_type") == "veg"
    assert (db.read(f"restaurants/{rid}/ingredients") or {}) == {}


def test_list_restaurants_returns_type(client, db, auth_headers):
    db.seed("restaurants/r1", {"name": "R1", "restaurant_type": "veg", "created_at": 1})
    rows = client.get("/api/superadmin/restaurants", headers=auth_headers).get_json()
    row = next(r for r in rows if r["rid"] == "r1")
    assert row["restaurant_type"] == "veg"


def test_update_restaurant_type(client, db, auth_headers):
    db.seed("restaurants/r1", {"name": "R", "restaurant_type": "mixed"})
    resp = client.put("/api/superadmin/restaurant/r1", json={
        "restaurant_name": "R", "owner_name": "O", "email": "o@x.com", "restaurant_type": "veg",
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert db.read("restaurants/r1/restaurant_type") == "veg"


# -------------------------- update_restaurant -------------------------
def test_update_restaurant_missing_fields(client, db, auth_headers):
    db.seed("restaurants/r1", {"name": "R"})
    resp = client.put("/api/superadmin/restaurant/r1", json={"restaurant_name": "X"}, headers=auth_headers)
    assert resp.status_code == 400


def test_update_restaurant_admin_exists(client, db, auth_headers):
    db.seed("restaurants/r1", {"name": "Old"})
    db.seed("users/u0", {"restaurant_id": "other", "name": "OtherOwner", "email": "o0@x.com"})  # non-matching, first
    db.seed("users/u1", {"restaurant_id": "r1", "name": "Old", "email": "old@x.com", "password": "x"})
    resp = client.put("/api/superadmin/restaurant/r1", json={
        "restaurant_name": "New", "owner_name": "Owner", "email": "new@x.com", "password": "fresh"
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert db.read("restaurants/r1/name") == "New"
    user = db.read("users/u1")
    assert user["name"] == "Owner"
    assert user["email"] == "new@x.com"
    assert user["password"] != "fresh"  # re-hashed


def test_update_restaurant_admin_exists_no_password(client, db, auth_headers):
    db.seed("restaurants/r1", {"name": "R"})
    db.seed("users/u1", {"restaurant_id": "r1", "name": "O", "email": "o@x.com", "password": "keep"})
    resp = client.put("/api/superadmin/restaurant/r1", json={
        "restaurant_name": "R", "owner_name": "O", "email": "o@x.com"
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert db.read("users/u1/password") == "keep"  # unchanged


def test_update_restaurant_creates_admin_when_missing(client, db, auth_headers):
    db.seed("restaurants/r1", {"name": "R"})
    resp = client.put("/api/superadmin/restaurant/r1", json={
        "restaurant_name": "R", "owner_name": "Owner", "email": "owner@x.com", "password": "p"
    }, headers=auth_headers)
    assert resp.status_code == 200
    users = db.read("users") or {}
    assert any(u.get("email") == "owner@x.com" and u["role"] == "owner" for u in users.values())


# -------------------------- delete_restaurant -------------------------
def test_delete_restaurant_cascades(client, db, auth_headers):
    db.seed_many({
        "restaurants/r1": {"name": "R1", "main_categories": {"a": {}}, "items": {"i": {}}, "tables": {"t": {}}},
        "restaurants/r2": {"name": "R2"},
        "users/u1": {"restaurant_id": "r1", "name": "A"},
        "users/u2": {"restaurant_id": "r2", "name": "B"},
    })
    resp = client.delete("/api/superadmin/restaurant/r1", headers=auth_headers)
    assert resp.status_code == 200
    assert db.read("restaurants/r1") is None
    assert db.read("users/u1") is None
    # other restaurant untouched
    assert db.read("restaurants/r2/name") == "R2"
    assert db.read("users/u2/name") == "B"
