import json
import os

from settings import settings

import firebase_admin
from firebase_admin import credentials, db

_db_ref = None

def init_firebase():
    global _db_ref
    if not firebase_admin._apps:
        if settings.firebase_credentials:
            creds_dict = json.loads(settings.firebase_credentials)
            cred = credentials.Certificate(creds_dict)
        elif settings.firebase_credentials_path:
            key_path = settings.firebase_credentials_path
            cred = credentials.Certificate(key_path)
        else:
            key_path = os.path.join(os.path.dirname(__file__), 'firebase-credentials.json')
            cred = credentials.Certificate(key_path)
            

        firebase_admin.initialize_app(cred, {
            'databaseURL': settings.firebase_database_url
        })
    _db_ref = db.reference()
    print("Firebase Realtime Database initialized successfully!")

def get_db():
    global _db_ref
    if _db_ref is None:
        init_firebase()
    return _db_ref


_REV_DOMAINS = ('orders', 'tables')


def bump_rev(restaurant_id, *domains):
    """Bump a lightweight per-restaurant invalidation counter.

    Frontend clients subscribe to restaurants/{restaurant_id}/_rev via Firebase
    onValue. The node holds only integers (no business data), so it can be
    publicly readable; a change tells listeners to refetch their own
    (auth'd/scoped) REST endpoint instead of polling on a timer."""
    if not restaurant_id:
        return
    updates = {
        domain: db.ServerValue.increment(1)
        for domain in domains
        if domain in _REV_DOMAINS
    }
    if updates:
        get_db().child(f'restaurants/{restaurant_id}/_rev').update(updates)
