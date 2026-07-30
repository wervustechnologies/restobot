import bcrypt


def hash_pw(pw):
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ----------------------------- /auth/login -----------------------------
def test_login_missing_fields(client):
    resp = client.post("/api/auth/login", json={})
    assert resp.status_code == 400
    assert resp.get_json()["message"] == "Email and password required"


def test_login_user_not_found(client, db):
    resp = client.post("/api/auth/login", json={"email": "no@x.com", "password": "p"})
    assert resp.status_code == 401
    assert resp.get_json()["message"] == "Invalid credentials"


def test_login_waiter_forbidden(client, db):
    db.seed("users/u1", {
        "email": "w@x.com", "password": hash_pw("pw"), "role": "waiter",
        "restaurant_id": "r1", "name": "W",
    })
    resp = client.post("/api/auth/login", json={"email": "w@x.com", "password": "pw"})
    assert resp.status_code == 403
    assert "Waiter Login" in resp.get_json()["message"]


def test_login_wrong_password(client, db):
    db.seed("users/u1", {
        "email": "a@x.com", "password": hash_pw("pw"), "role": "owner",
        "restaurant_id": "r1", "name": "A",
    })
    resp = client.post("/api/auth/login", json={"email": "a@x.com", "password": "wrong"})
    assert resp.status_code == 401
    assert resp.get_json()["message"] == "Invalid credentials"


def test_login_success(client, db):
    db.seed("users/u1", {
        "email": "a@x.com", "password": hash_pw("pw"), "role": "owner",
        "restaurant_id": "r1", "name": "Alice",
    })
    db.seed("restaurants/r1", {"name": "Resto"})
    resp = client.post("/api/auth/login", json={"email": "a@x.com", "password": "pw"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["token"]
    assert body["restaurant_id"] == "r1"
    assert body["user"]["restaurant_name"] == "Resto"
    assert body["user"]["email"] == "a@x.com"


# ------------------------- /auth/register-waiter -----------------------
def test_register_waiter_requires_auth(client):
    resp = client.post("/api/auth/register-waiter", json={})
    assert resp.status_code == 401


def test_register_waiter_missing_fields(client, auth_headers):
    resp = client.post("/api/auth/register-waiter", json={"name": "X"}, headers=auth_headers)
    assert resp.status_code == 400


def test_register_waiter_email_exists(client, db, auth_headers):
    db.seed("users/existing", {"email": "dup@x.com"})
    resp = client.post(
        "/api/auth/register-waiter",
        json={"name": "N", "email": "dup@x.com", "password": "p"},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert resp.get_json()["message"] == "Email already exists"


def test_register_waiter_success(client, db, auth_headers):
    resp = client.post(
        "/api/auth/register-waiter",
        json={"name": "New", "email": "new@x.com", "password": "secret"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    uid = resp.get_json()["user_id"]
    created = db.read(f"users/{uid}")
    assert created["role"] == "waiter"
    assert created["restaurant_id"] == "r1"  # from token
    assert created["name"] == "New"
    # password stored hashed, not plaintext
    assert created["password"] != "secret"


# --------------------------- /auth/waiters -----------------------------
def test_list_waiters_filters_role_and_sorts(client, db, auth_headers):
    db.seed_many({
        "users/u1": {"role": "waiter", "restaurant_id": "r1", "name": "A", "email": "a@x.com", "created_at": 1},
        "users/u2": {"role": "waiter", "restaurant_id": "r1", "name": "B", "email": "b@x.com", "created_at": 5},
        "users/u3": {"role": "owner", "restaurant_id": "r1", "name": "Owner", "email": "o@x.com", "created_at": 9},
        "users/u4": {"role": "waiter", "restaurant_id": "OTHER", "name": "C", "email": "c@x.com", "created_at": 9},
    })
    resp = client.get("/api/auth/waiters", headers=auth_headers)
    assert resp.status_code == 200
    waiters = resp.get_json()
    # only r1 waiters, newest first
    assert [w["name"] for w in waiters] == ["B", "A"]


def test_list_waiters_empty(client, auth_headers):
    resp = client.get("/api/auth/waiters", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json() == []


# ------------------------ /auth/waiters/<id> --------------------------
def test_delete_waiter_not_found(client, auth_headers):
    resp = client.delete("/api/auth/waiters/ghost", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_waiter_wrong_restaurant(client, db, auth_headers):
    db.seed("users/u1", {"restaurant_id": "OTHER", "role": "waiter"})
    resp = client.delete("/api/auth/waiters/u1", headers=auth_headers)
    assert resp.status_code == 403


def test_delete_waiter_not_a_waiter(client, db, auth_headers):
    db.seed("users/u1", {"restaurant_id": "r1", "role": "owner"})
    resp = client.delete("/api/auth/waiters/u1", headers=auth_headers)
    assert resp.status_code == 400


def test_delete_waiter_success(client, db, auth_headers):
    db.seed("users/u1", {"restaurant_id": "r1", "role": "waiter"})
    resp = client.delete("/api/auth/waiters/u1", headers=auth_headers)
    assert resp.status_code == 200
    assert db.read("users/u1") is None


# ------------------------- /auth/waiter-login --------------------------
def test_waiter_login_missing_fields(client):
    resp = client.post("/api/auth/waiter-login", json={"email": "x@x.com"})
    assert resp.status_code == 400


def test_waiter_login_not_found(client):
    resp = client.post("/api/auth/waiter-login", json={"email": "x@x.com", "password": "p"})
    assert resp.status_code == 401


def test_waiter_login_not_waiter_role(client, db):
    db.seed("users/u1", {
        "email": "o@x.com", "password": hash_pw("pw"), "role": "owner",
        "restaurant_id": "r1", "name": "O",
    })
    resp = client.post("/api/auth/waiter-login", json={"email": "o@x.com", "password": "pw"})
    assert resp.status_code == 403


def test_waiter_login_wrong_password(client, db):
    db.seed("users/u1", {
        "email": "w@x.com", "password": hash_pw("pw"), "role": "waiter",
        "restaurant_id": "r1", "name": "W",
    })
    resp = client.post("/api/auth/waiter-login", json={"email": "w@x.com", "password": "no"})
    assert resp.status_code == 401


def test_waiter_login_success(client, db):
    db.seed("users/u1", {
        "email": "w@x.com", "password": hash_pw("pw"), "role": "waiter",
        "restaurant_id": "r1", "name": "Wally",
    })
    resp = client.post("/api/auth/waiter-login", json={"email": "w@x.com", "password": "pw"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["token"]
    assert body["user"]["role"] == "waiter"
    assert body["user"]["id"] == "u1"
