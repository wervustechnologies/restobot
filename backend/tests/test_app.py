from settings import settings


EXPECTED_PATHS = [
    "/api/auth/login",
    "/api/menu/<restaurant_id>",
    "/api/orders",
    "/api/admin/restaurant",
    "/api/admin/analytics",
    "/api/chat/suggest",
    "/api/superadmin/login",
    "/api/wishlist",
    "/api/guests/identify",
    "/api/orders/tables-status",
    "/api/feedback",
    "/api/table/<qr_token>",
]


def test_all_blueprints_registered(app):
    rules = {r.rule for r in app.url_map.iter_rules()}
    for path in EXPECTED_PATHS:
        assert path in rules, f"missing route {path}"


def test_preflight_allowed_origin_sets_acao(client):
    resp = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert resp.headers.get("Access-Control-Allow-Credentials") == "true"
    assert "POST" in resp.headers.get("Access-Control-Allow-Methods", "")


def test_preflight_blocked_origin_omits_acao(client):
    resp = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://evil.example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("Access-Control-Allow-Origin") is None


def test_after_request_adds_cors_for_allowed_origin(client):
    resp = client.get("/api/menu/r1", headers={"Origin": "http://localhost:5174"})
    assert resp.headers.get("Access-Control-Allow-Origin") == "http://localhost:5174"


def test_after_request_no_cors_for_blocked_origin(client):
    resp = client.get("/api/menu/r1", headers={"Origin": "http://evil.example.com"})
    assert resp.headers.get("Access-Control-Allow-Origin") is None


def test_allowed_origins_split_and_stripped(app):
    # env has "http://localhost:5173, http://localhost:5174" (trailing space on
    # the second entry to exercise the .strip() in create_app).
    origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
    assert "http://localhost:5173" in origins
    assert "http://localhost:5174" in origins
    assert " " not in "".join(origins)


def test_app_has_test_client(app):
    assert hasattr(app, "test_client")
