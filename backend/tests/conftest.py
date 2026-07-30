"""Shared test fixtures for the RestoBot backend.

Provides an in-memory fake of the Firebase Realtime Database (RTDB) so route
tests never touch a live Firebase instance. The fake mimics the subset of the
RTDB API the application actually uses:

    db.child(path).get()
    db.child(path).set(value)
    db.child(path).update({...})
    db.child(path).delete()
    db.child(path).push(value)         -> ref with .key
    db.child(path).order_by_child(f).equal_to(v).get()
    db.child(path).order_by_child(f).start_at(a).end_at(b).get()
    db.child(path).order_by_child(f).equal_to(v).limit_to_last(n).get()
    db.update({full/path: value, ...})  (root multi-path update)

It is wired in by pointing ``firebase_client._db_ref`` at the fake root and
swapping ``firebase_client.db`` (used only for ``ServerValue.increment`` in
``bump_rev``), so the real ``get_db``/``bump_rev`` functions used by every
route operate against the fake without any per-module patching.
"""
import os

# --- Env setup MUST happen before app/settings are imported -------------
# pydantic-settings reads these at import time; settings.jwt_secret_key is
# captured once by auth_utils at import.
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ.setdefault("FIREBASE_DATABASE_URL", "https://test.firebaseio.com")
os.environ.setdefault(
    "ALLOWED_ORIGINS",
    "http://localhost:5173, http://localhost:5174",
)

import copy
import uuid

import pytest

import firebase_client
import app as app_module
from limiter import limiter


# =========================================================================
# In-memory RTDB fake
# =========================================================================
class Increment:
    """Sentinel standing in for firebase_admin.db.ServerValue.increment(n)."""

    __slots__ = ("n",)

    def __init__(self, n):
        self.n = n


class _ServerValue:
    @staticmethod
    def increment(n):
        return Increment(n)


def _walk(tree, parts, create=False):
    node = tree
    for key in parts:
        if not isinstance(node, dict):
            return None
        if key not in node:
            if not create:
                return None
            node[key] = {}
        elif not isinstance(node[key], dict) and create:
            node[key] = {}
        node = node[key]
    return node


def _get_parts(tree, parts):
    node = _walk(tree, parts)
    return copy.deepcopy(node) if node is not None else None


def _set_parts(tree, parts, value):
    if not parts:
        tree.clear()
        if isinstance(value, dict):
            tree.update(copy.deepcopy(value))
        return
    parent = _walk(tree, parts[:-1], create=True)
    if parent is None:
        return
    if value is None:
        parent.pop(parts[-1], None)
    else:
        parent[parts[-1]] = copy.deepcopy(value)


def _apply_value(tree, parts, value):
    """Set or merge a single value at an absolute path (RTDB update semantics)."""
    if isinstance(value, Increment):
        parent = _walk(tree, parts[:-1], create=True)
        if not isinstance(parent, dict):
            return
        current = parent.get(parts[-1])
        base = current if isinstance(current, (int, float)) else 0
        parent[parts[-1]] = base + value.n
        return
    if isinstance(value, dict):
        node = _walk(tree, parts, create=True)
        if not isinstance(node, dict):
            _set_parts(tree, parts, value)
            return
        for k, v in value.items():
            if isinstance(v, Increment):
                current = node.get(k)
                base = current if isinstance(current, (int, float)) else 0
                node[k] = base + v.n
            else:
                node[k] = copy.deepcopy(v)
    else:
        _set_parts(tree, parts, value)


class _Query:
    def __init__(self, ref, field=None, eq=None, start=None, end=None, limit_last=None):
        self.ref = ref
        self.field = field
        self.eq = eq
        self.start = start
        self.end = end
        self.limit_last = limit_last

    def order_by_child(self, field):
        return _Query(self.ref, field, self.eq, self.start, self.end, self.limit_last)

    def equal_to(self, value):
        return _Query(self.ref, self.field, value, self.start, self.end, self.limit_last)

    def start_at(self, value):
        return _Query(self.ref, self.field, self.eq, value, self.end, self.limit_last)

    def end_at(self, value):
        return _Query(self.ref, self.field, self.eq, self.start, value, self.limit_last)

    def limit_to_last(self, n):
        return _Query(self.ref, self.field, self.eq, self.start, self.end, n)

    def get(self):
        data = self.ref.get()
        if data is None:
            return None
        if not isinstance(data, dict):
            return data
        out = {}
        for key, val in data.items():
            field_val = val.get(self.field) if isinstance(val, dict) and self.field else None
            keep = True
            if self.eq is not None:
                keep = field_val == self.eq
            if keep and self.start is not None:
                keep = field_val is not None and field_val >= self.start
            if keep and self.end is not None:
                keep = field_val is not None and field_val <= self.end
            if keep:
                out[key] = val
        if self.limit_last and len(out) > self.limit_last:
            keys = list(out.keys())
            out = {k: out[k] for k in keys[-self.limit_last:]}
        return out if out else None


class _Ref:
    def __init__(self, tree, parts):
        self._tree = tree
        self._parts = parts

    def child(self, sub):
        parts = self._parts + (sub.split("/") if sub else [])
        return _Ref(self._tree, parts)

    def order_by_child(self, field):
        return _Query(self, field)

    def get(self):
        return _get_parts(self._tree, self._parts)

    def set(self, value):
        _set_parts(self._tree, self._parts, value)

    def update(self, updates):
        for k, v in updates.items():
            parts = k.split("/") if "/" in k else (self._parts + [k])
            _apply_value(self._tree, parts, v)

    def delete(self):
        if not self._parts:
            self._tree.clear()
            return
        parent = _walk(self._tree, self._parts[:-1])
        if isinstance(parent, dict):
            parent.pop(self._parts[-1], None)

    def push(self, value):
        key = "-" + uuid.uuid4().hex[:20]
        _set_parts(self._tree, self._parts + [key], value)
        return _PushRef(self._tree, self._parts + [key], key)


class _PushRef(_Ref):
    def __init__(self, tree, parts, key):
        super().__init__(tree, parts)
        self.key = key


class FakeRTDB:
    """A fresh in-memory RTDB tree. Exposed to tests via the `db` fixture."""

    def __init__(self):
        self.tree = {}
        self.root = _Ref(self.tree, [])

    def reset(self):
        self.tree.clear()

    # convenience for tests to seed data directly
    def seed(self, path, value):
        _set_parts(self.tree, path.split("/"), value)

    def seed_many(self, mapping):
        for path, value in mapping.items():
            self.seed(path, value)

    def read(self, path):
        return _get_parts(self.tree, path.split("/"))

    # mirror the bits of the firebase_admin.db module surface we touch
    def child(self, path):
        return self.root.child(path)

    def reference(self):
        return self.root

    def update(self, updates):
        self.root.update(updates)


class _FakeFirebaseModule:
    ServerValue = _ServerValue


# =========================================================================
# Fixtures
# =========================================================================
@pytest.fixture
def db(monkeypatch):
    """A fresh in-memory Firebase, wired into firebase_client for this test."""
    fake = FakeRTDB()
    monkeypatch.setattr(firebase_client, "_db_ref", fake.root)
    monkeypatch.setattr(firebase_client, "db", _FakeFirebaseModule)
    return fake


@pytest.fixture
def app(db, monkeypatch):
    # create_app() would call the real init_firebase(); skip it, the `db`
    # fixture already points _db_ref at the fake.
    monkeypatch.setattr(app_module, "init_firebase", lambda: None)
    flask_app = app_module.create_app()
    flask_app.config.update(TESTING=True)
    limiter.enabled = False  # disable rate limiting in tests
    return flask_app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def make_token():
    """Return a callable that mints real JWTs (decoded by token_required)."""
    from auth_utils import generate_token

    def _make(user_id="u1", restaurant_id="r1", is_superadmin=False):
        return generate_token(user_id, restaurant_id, is_superadmin)

    return _make


@pytest.fixture
def auth_headers(make_token):
    token = make_token()
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def superadmin_headers(make_token):
    token = make_token(user_id="superadmin_id", restaurant_id="all", is_superadmin=True)
    return {"Authorization": f"Bearer {token}"}
