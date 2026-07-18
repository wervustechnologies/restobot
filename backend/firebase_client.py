import firebase_admin
from firebase_admin import credentials, db
import os

_db_ref = None

import json

def init_firebase():
    global _db_ref
    if not firebase_admin._apps:
        firebase_creds_json = os.environ.get('FIREBASE_CREDENTIALS')
        if firebase_creds_json:
            creds_dict = json.loads(firebase_creds_json)
            cred = credentials.Certificate(creds_dict)
        else:
            # Fallback to the local file for development
            key_path = os.path.join(os.path.dirname(__file__), 'firebase-credentials.json')
            cred = credentials.Certificate(key_path)
            
        firebase_admin.initialize_app(cred, {
            'databaseURL': 'https://restobot-80b61-default-rtdb.firebaseio.com/'
        })
    _db_ref = db.reference()
    print("Firebase Realtime Database initialized successfully!")

def get_db():
    global _db_ref
    if _db_ref is None:
        init_firebase()
    return _db_ref
