"""Tests for routes/tables.py (public QR-driven table endpoints)."""


def _wire_table(db, qr="tok", restaurant_id="r1", table_id="t1", number="3", **extra):
    db.seed(f"table_tokens/{qr}", {
        "restaurant_id": restaurant_id,
        "table_id": table_id,
        "table_number": number,
    })
    db.seed(f"restaurants/{restaurant_id}/tables/{table_id}", {
        "table_number": number,
        **extra,
    })


# ----------------------------- get_table ------------------------------
def test_get_table_not_found(client):
    resp = client.get("/api/table/bad-token")
    assert resp.status_code == 404


def test_get_table_found(client, db):
    _wire_table(db)
    resp = client.get("/api/table/tok")
    assert resp.status_code == 200
    assert resp.get_json()["table_number"] == "3"


# ------------------------- get_table_lock_status ----------------------
def test_lock_status_table_not_found(client, db):
    resp = client.get("/api/table/bad/lock-status")
    assert resp.status_code == 404


def test_lock_status_missing_table_data(client, db):
    # token resolves restaurant/table_id but the table node is gone
    db.seed("table_tokens/tok", {"restaurant_id": "r1", "table_id": "t1", "table_number": "3"})
    resp = client.get("/api/table/tok/lock-status")
    assert resp.status_code == 404


def test_lock_status_token_without_ids(client, db):
    db.seed("table_tokens/tok", {"table_number": "3"})  # no restaurant_id/table_id
    resp = client.get("/api/table/tok/lock-status")
    assert resp.status_code == 404


def test_lock_status_success(client, db):
    _wire_table(db, locked_by="w1", locked_by_name="W", call_waiter=True, call_waiter_at=5)
    resp = client.get("/api/table/tok/lock-status")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["locked_by"] == "w1"
    assert body["call_waiter"] is True
    assert body["table_number"] == "3"
    assert body["restaurant_id"] == "r1"


# ----------------------------- call_waiter ----------------------------
def test_call_waiter_not_found(client):
    resp = client.post("/api/table/bad/call-waiter")
    assert resp.status_code == 404


def test_call_waiter_success(client, db):
    _wire_table(db)
    resp = client.post("/api/table/tok/call-waiter")
    assert resp.status_code == 200
    assert db.read("restaurants/r1/tables/t1/call_waiter") is True
    assert db.read("restaurants/r1/_rev/tables") == 1


def test_resolve_table_missing_ids(client, db):
    # token exists but lacks restaurant_id -> _resolve_table returns None tuple
    db.seed("table_tokens/tok", {"table_id": "t1", "table_number": "3"})
    resp = client.post("/api/table/tok/call-waiter")
    assert resp.status_code == 404
