import datetime

import jwt
import pytest

import auth_utils
from settings import settings


def test_generate_token_contains_claims(make_token):
    token = make_token(user_id="u42", restaurant_id="r9", is_superadmin=True)
    decoded = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
    assert decoded["sub"] == "u42"
    assert decoded["restaurant_id"] == "r9"
    assert decoded["is_superadmin"] is True
    assert decoded["iat"] < decoded["exp"]


def test_token_required_passes_through_options(client):
    # The before_request CORS handler intercepts OPTIONS before token_required
    # runs, so preflight must never require auth (no 401).
    resp = client.options("/api/auth/waiters")
    assert resp.status_code == 200


def test_token_required_missing_header(client):
    resp = client.get("/api/auth/waiters")
    assert resp.status_code == 401
    assert resp.get_json()["message"] == "Token is missing!"


def test_token_required_bad_scheme(client):
    resp = client.get(
        "/api/auth/waiters", headers={"Authorization": "Basic abc"}
    )
    assert resp.status_code == 401
    assert resp.get_json()["message"] == "Token is missing!"


def test_token_required_invalid_token(client):
    resp = client.get(
        "/api/auth/waiters", headers={"Authorization": "Bearer not.a.jwt"}
    )
    assert resp.status_code == 401
    assert resp.get_json()["message"] == "Token is invalid!"


def test_token_required_expired_token(client):
    payload = {
        "exp": datetime.datetime.utcnow() - datetime.timedelta(seconds=10),
        "iat": datetime.datetime.utcnow(),
        "sub": "u1",
        "restaurant_id": "r1",
        "is_superadmin": False,
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")
    resp = client.get(
        "/api/auth/waiters", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 401
    assert resp.get_json()["message"] == "Token is invalid!"


def test_token_required_valid_token_attaches_identity(client, db, make_token):
    # Seed a couple of users so the protected list endpoint returns data and
    # confirms request.user_id / request.restaurant_id were set by the guard.
    token = make_token(user_id="u1", restaurant_id="r1")
    db.seed("users/u1", {
        "name": "A", "email": "a@x.com", "restaurant_id": "r1",
        "role": "waiter", "created_at": 1,
    })
    resp = client.get(
        "/api/auth/waiters", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    assert isinstance(resp.get_json(), list)


def test_secret_key_matches_settings():
    assert auth_utils.SECRET_KEY == settings.jwt_secret_key


def test_token_required_options_short_circuit_direct(app):
    # In a real request the before_request CORS handler intercepts OPTIONS, so
    # this guard is only reachable by invoking the (decorated) view directly
    # inside an OPTIONS request context.
    from routes.auth import list_waiters

    with app.test_request_context("/api/auth/waiters", method="OPTIONS"):
        result = list_waiters()
    assert result == ("", 204)
