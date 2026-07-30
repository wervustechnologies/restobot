"""Tests for routes/guests.py (guest identification + loyalty points)."""
import time


def _guest(db, gid, **extra):
    db.seed(f"guests/{gid}", {"visit_count": 1, "points": 0, "fingerprint": "fp1",
                              "last_visit": time.time(), **extra})


# --------------------------- identify_guest ---------------------------
def test_identify_missing_fingerprint(client):
    resp = client.post("/api/guests/identify", json={})
    assert resp.status_code == 400


def test_identify_creates_new_guest(client, db):
    resp = client.post("/api/guests/identify", json={"fingerprint": "newfp", "name": "  Alice  "})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["success"] is True
    assert body["visit_count"] == 1
    assert body["points"] == 0
    assert body["name"] == "Alice"  # stripped
    gid = body["guest_id"]
    assert db.read(f"guests/{gid}/fingerprint") == "newfp"


def test_identify_creates_new_guest_without_name(client, db):
    resp = client.post("/api/guests/identify", json={"fingerprint": "noname"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["name"] == ""
    assert db.read(f"guests/{body['guest_id']}/name") is None  # name key not set


def test_identify_returning_within_hour_no_increment(client, db):
    _guest(db, "g1", last_visit=time.time() - 60)
    body = client.post("/api/guests/identify", json={"fingerprint": "fp1"}).get_json()
    assert body["visit_count"] == 1
    assert body["guest_id"] == "g1"


def test_identify_returning_after_hour_increments(client, db):
    _guest(db, "g1", visit_count=2, last_visit=time.time() - 4000)
    body = client.post("/api/guests/identify", json={"fingerprint": "fp1"}).get_json()
    assert body["visit_count"] == 3


def test_identify_fifth_visit_awards_points(client, db):
    _guest(db, "g1", visit_count=4, points=0, last_visit=time.time() - 4000)
    body = client.post("/api/guests/identify", json={"fingerprint": "fp1"}).get_json()
    assert body["visit_count"] == 5
    assert body["points"] == 5


def test_identify_does_not_overwrite_existing_name(client, db):
    _guest(db, "g1", name="Old", last_visit=time.time() - 4000)
    body = client.post("/api/guests/identify", json={"fingerprint": "fp1", "name": "New"}).get_json()
    assert body["name"] == "Old"
    assert db.read("guests/g1/name") == "Old"


def test_identify_sets_name_first_time(client, db):
    _guest(db, "g1", last_visit=time.time() - 4000)  # no name
    body = client.post("/api/guests/identify", json={"fingerprint": "fp1", "name": "First"}).get_json()
    assert body["name"] == "First"
    assert db.read("guests/g1/name") == "First"


# ---------------------------- set_guest_name --------------------------
def test_set_guest_name_missing(client, db):
    _guest(db, "g1")
    resp = client.put("/api/guests/g1/name", json={})
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "Name is required"


def test_set_guest_name_non_string_normalized_to_empty(client, db):
    _guest(db, "g1")
    resp = client.put("/api/guests/g1/name", json={"name": 123})
    assert resp.status_code == 400  # int -> '' -> required


def test_set_guest_name_truncates_to_thirty(client, db):
    _guest(db, "g1")
    resp = client.put("/api/guests/g1/name", json={"name": "B" * 50})
    assert resp.status_code == 200
    assert len(resp.get_json()["name"]) == 30


def test_set_guest_name_not_found(client):
    resp = client.put("/api/guests/ghost/name", json={"name": "X"})
    assert resp.status_code == 404


def test_set_guest_name_success(client, db):
    _guest(db, "g1")
    resp = client.put("/api/guests/g1/name", json={"name": "  Bob  "})
    assert resp.status_code == 200
    assert resp.get_json()["name"] == "Bob"
    assert db.read("guests/g1/name") == "Bob"


def test_set_guest_name_empty_guard(app):
    # /guests/<guest_id>/name requires a non-empty segment; exercise directly.
    from routes.guests import set_guest_name
    with app.test_request_context("/x", method="PUT", json={}):
        _, status = set_guest_name("")
    assert status == 400
