import jwt
import bcrypt

from auth_utils import SECRET_KEY, generate_token
from settings import settings


def hash_pw(pw):
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _seed_admin(db):
    db.seed("users/u1", {
        "email": "a@x.com", "password": hash_pw("pw"), "role": "owner",
        "restaurant_id": "r1", "name": "Alice",
    })
    db.seed("restaurants/r1", {"name": "Resto"})


def _login(client):
    resp = client.post("/api/auth/login", json={"email": "a@x.com", "password": "pw"})
    assert resp.status_code == 200
    return resp.get_json()


def _refresh(client, raw):
    return client.post("/api/auth/refresh", json={"refresh_token": raw})


# 1. Admin login returns a refresh_token field alongside existing fields.
def test_admin_login_returns_refresh_token(client, db):
    _seed_admin(db)
    body = _login(client)
    assert body["token"]
    assert body["restaurant_id"] == "r1"
    assert isinstance(body["refresh_token"], str)
    assert body["refresh_token"]


# 2. Valid refresh -> 200 with rotated token + expires_in.
def test_refresh_returns_rotated_token(client, db):
    _seed_admin(db)
    raw = _login(client)["refresh_token"]
    resp = _refresh(client, raw)
    assert resp.status_code == 200
    out = resp.get_json()
    assert out["token"]
    assert out["refresh_token"]
    assert out["refresh_token"] != raw
    assert out["expires_in"] == settings.access_token_expires_minutes * 60


# 3. The OLD token is revoked after rotation -> reusing it returns 401.
def test_old_refresh_revoked_after_rotation(client, db):
    _seed_admin(db)
    raw = _login(client)["refresh_token"]
    assert _refresh(client, raw).status_code == 200
    resp = _refresh(client, raw)
    assert resp.status_code == 401


# 4. The NEW (rotated) token works for another rotation.
def test_new_refresh_works_after_rotation(client, db):
    _seed_admin(db)
    raw = _login(client)["refresh_token"]
    first = _refresh(client, raw)
    assert first.status_code == 200
    new_raw = first.get_json()["refresh_token"]
    second = _refresh(client, new_raw)
    assert second.status_code == 200
    assert second.get_json()["refresh_token"] != new_raw


# 5. Reuse detection burns the whole family: OLD reuse -> 401, NEW -> 401.
def test_reuse_detection_burns_family(client, db):
    _seed_admin(db)
    raw = _login(client)["refresh_token"]
    first = _refresh(client, raw)
    assert first.status_code == 200
    new_raw = first.get_json()["refresh_token"]

    reuse = _refresh(client, raw)
    assert reuse.status_code == 401

    # Family fully revoked: the rotated token now also fails.
    after = _refresh(client, new_raw)
    assert after.status_code == 401


# 6. Missing body -> 400; garbage token -> 401.
def test_refresh_missing_body(client):
    resp = client.post("/api/auth/refresh", json={})
    assert resp.status_code == 400
    assert resp.get_json()["message"] == "Refresh token required"


def test_refresh_garbage_token(client):
    resp = _refresh(client, "not-a-real-token")
    assert resp.status_code == 401


# 7. Logout revokes the refresh token; it then 401s on refresh.
def test_logout_revokes_refresh_token(client, db, auth_headers):
    _seed_admin(db)
    raw = _login(client)["refresh_token"]
    resp = client.post(
        "/api/auth/logout", json={"refresh_token": raw}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert _refresh(client, raw).status_code == 401


def test_logout_requires_auth(client):
    resp = client.post("/api/auth/logout", json={})
    assert resp.status_code == 401


# 8. Backward-compat: generate_token still returns a string and token_required
# still accepts a make_token()-minted access token on a protected route.
def test_generate_token_still_returns_string():
    token = generate_token("u", "r")
    assert isinstance(token, str)


def test_token_required_still_accepts_access_token(client, db, auth_headers):
    resp = client.get("/api/auth/waiters", headers=auth_headers)
    assert resp.status_code == 200


# 9. The access token now carries a type == 'access' claim.
def test_access_token_has_type_claim(make_token):
    token = make_token()
    decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    assert decoded["type"] == "access"


def test_refresh_mints_access_token_with_type_claim(client, db):
    _seed_admin(db)
    raw = _login(client)["refresh_token"]
    resp = _refresh(client, raw)
    assert resp.status_code == 200
    decoded = jwt.decode(resp.get_json()["token"], SECRET_KEY, algorithms=["HS256"])
    assert decoded["type"] == "access"
    assert decoded["sub"] == "u1"
