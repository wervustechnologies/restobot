import firebase_client
from firebase_client import _REV_DOMAINS


def test_get_db_initializes_when_none(monkeypatch):
    calls = {"n": 0}

    def fake_init():
        calls["n"] += 1
        firebase_client._db_ref = "STUB"

    monkeypatch.setattr(firebase_client, "_db_ref", None)
    monkeypatch.setattr(firebase_client, "init_firebase", fake_init)
    assert firebase_client.get_db() == "STUB"
    assert calls["n"] == 1


def test_get_db_returns_existing_without_reinit(monkeypatch):
    monkeypatch.setattr(firebase_client, "_db_ref", "EXISTING")

    def boom():
        raise AssertionError("init_firebase must not be called")

    monkeypatch.setattr(firebase_client, "init_firebase", boom)
    assert firebase_client.get_db() == "EXISTING"


def test_rev_domains_constant():
    assert _REV_DOMAINS == ("orders", "tables")


def test_bump_rev_no_restaurant(db):
    firebase_client.bump_rev("", "orders")
    firebase_client.bump_rev(None, "tables")
    assert db.read("restaurants/r1/_rev") in (None, {})


def test_bump_rev_ignores_unknown_domains(db):
    firebase_client.bump_rev("r1", "foo", "bar")
    assert db.read("restaurants/r1/_rev") in (None, {})


def test_bump_rev_increments_known_domains(db):
    firebase_client.bump_rev("r1", "orders", "foo")
    assert db.read("restaurants/r1/_rev/orders") == 1
    firebase_client.bump_rev("r1", "orders", "tables")
    assert db.read("restaurants/r1/_rev/orders") == 2
    assert db.read("restaurants/r1/_rev/tables") == 1


def test_bump_rev_merges_into_existing_node(db):
    db.seed("restaurants/r1/_rev", {"orders": 5, "tables": 2})
    firebase_client.bump_rev("r1", "orders", "tables")
    assert db.read("restaurants/r1/_rev/orders") == 6
    assert db.read("restaurants/r1/_rev/tables") == 3


# --------------------------- init_firebase ----------------------------
def _stub_firebase_internals(monkeypatch):
    """Make init_firebase runnable without a real service account."""
    monkeypatch.setattr(firebase_client.firebase_admin, "_apps", {})
    monkeypatch.setattr(firebase_client.credentials, "Certificate", lambda d: ("cred", d))
    monkeypatch.setattr(firebase_client.firebase_admin, "initialize_app", lambda *a, **k: None)
    captured = {}
    monkeypatch.setattr(firebase_client.db, "reference", lambda: "ROOTREF")
    return captured


def test_init_firebase_with_credentials_json(monkeypatch):
    _stub_firebase_internals(monkeypatch)
    monkeypatch.setattr(firebase_client.settings, "firebase_credentials", '{"type":"service_account"}')
    monkeypatch.setattr(firebase_client.settings, "firebase_credentials_path", None)
    firebase_client.init_firebase()
    assert firebase_client._db_ref == "ROOTREF"


def test_init_firebase_with_credentials_path(monkeypatch):
    _stub_firebase_internals(monkeypatch)
    monkeypatch.setattr(firebase_client.settings, "firebase_credentials", None)
    monkeypatch.setattr(firebase_client.settings, "firebase_credentials_path", "/some/path.json")
    firebase_client.init_firebase()
    assert firebase_client._db_ref == "ROOTREF"


def test_init_firebase_fallback_path(monkeypatch):
    _stub_firebase_internals(monkeypatch)
    monkeypatch.setattr(firebase_client.settings, "firebase_credentials", None)
    monkeypatch.setattr(firebase_client.settings, "firebase_credentials_path", None)
    firebase_client.init_firebase()
    assert firebase_client._db_ref == "ROOTREF"


def test_init_firebase_skips_when_already_initialized(monkeypatch):
    # _apps non-empty -> initialization body skipped, but _db_ref still set
    monkeypatch.setattr(firebase_client.firebase_admin, "_apps", {"app": object()})
    monkeypatch.setattr(firebase_client.db, "reference", lambda: "ALREADY_ROOT")
    firebase_client.init_firebase()
    assert firebase_client._db_ref == "ALREADY_ROOT"
