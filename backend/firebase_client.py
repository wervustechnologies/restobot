import json
import os

from settings import settings

import firebase_admin
from firebase_admin import credentials, db

def init_firebase():
    global _db_ref
    if not firebase_admin._apps:
        if settings.firebase_credentials:
            creds_dict = json.loads(settings.firebase_credentials)
            cred = credentials.Certificate(creds_dict)
        else:
            # Fallback to the local file for development
            key_path = os.path.join(os.path.dirname(__file__), 'restobot-80b61-firebase-adminsdk-fbsvc-93905b0093.json')
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
