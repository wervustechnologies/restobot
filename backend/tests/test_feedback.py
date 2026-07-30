"""Tests for routes/feedback.py."""


# --------------------------- submit_feedback --------------------------
def test_submit_feedback_missing_restaurant(client):
    resp = client.post("/api/feedback", json={"rating": 5})
    assert resp.status_code == 400


def test_submit_feedback_rating_not_int(client):
    resp = client.post("/api/feedback", json={"restaurant_id": "r1", "rating": "5"})
    assert resp.status_code == 400


def test_submit_feedback_rating_float_not_int(client):
    resp = client.post("/api/feedback", json={"restaurant_id": "r1", "rating": 5.0})
    assert resp.status_code == 400


def test_submit_feedback_rating_too_low(client):
    resp = client.post("/api/feedback", json={"restaurant_id": "r1", "rating": 0})
    assert resp.status_code == 400


def test_submit_feedback_rating_too_high(client):
    resp = client.post("/api/feedback", json={"restaurant_id": "r1", "rating": 6})
    assert resp.status_code == 400


def test_submit_feedback_success(client, db):
    resp = client.post("/api/feedback", json={
        "restaurant_id": "r1", "rating": 4, "description": "Great", "guest_id": "g1",
    })
    assert resp.status_code == 201
    fids = list((db.read("restaurants/r1/feedback") or {}).keys())
    saved = db.read(f"restaurants/r1/feedback/{fids[0]}")
    assert saved["rating"] == 4
    assert saved["description"] == "Great"
    assert saved["guest_id"] == "g1"
    assert "created_at" in saved


# ----------------------------- get_feedback ---------------------------
def test_get_feedback_sorted_desc(client, db, auth_headers):
    db.seed("restaurants/r1/feedback", {
        "f1": {"rating": 5, "created_at": 1},
        "f2": {"rating": 3, "created_at": 9},
    })
    resp = client.get("/api/admin/feedback", headers=auth_headers)
    assert resp.status_code == 200
    assert [f["id"] for f in resp.get_json()] == ["f2", "f1"]


def test_get_feedback_empty(client, auth_headers):
    resp = client.get("/api/admin/feedback", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json() == []
