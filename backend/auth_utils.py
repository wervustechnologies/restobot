import jwt
import datetime
import secrets
import hashlib
import uuid
import time
from functools import wraps
from flask import request, jsonify
from firebase_client import get_db
from settings import settings

SECRET_KEY = settings.jwt_secret_key


class RefreshTokenReuseError(Exception):
    """Raised when a revoked refresh token is presented again (reuse detected)."""
    pass


def _hash_token(raw):
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def generate_access_token(user_id, restaurant_id, is_superadmin=False):
    now = datetime.datetime.utcnow()
    payload = {
        'exp': now + datetime.timedelta(minutes=settings.access_token_expires_minutes),
        'iat': now,
        'sub': user_id,
        'restaurant_id': restaurant_id,
        'is_superadmin': is_superadmin,
        'type': 'access',
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


# Alias so the ~56 existing call sites and the test `make_token` fixture keep
# working unchanged.
generate_token = generate_access_token


def create_refresh_token(user_id, restaurant_id, is_superadmin=False, family_id=None):
    raw = secrets.token_urlsafe(48)
    family_id = family_id or str(uuid.uuid4())
    now = time.time()
    expires_at = now + settings.refresh_token_expires_days * 86400
    record = {
        'user_id': user_id,
        'restaurant_id': restaurant_id,
        'is_superadmin': is_superadmin,
        'family_id': family_id,
        'expires_at': expires_at,
        'created_at': now,
        'revoked': False,
    }
    get_db().child('refresh_tokens').child(_hash_token(raw)).set(record)
    return raw, family_id


def _get_refresh_record(raw):
    rec = get_db().child('refresh_tokens').child(_hash_token(raw)).get()
    return rec if rec is not None else None


def revoke_refresh_token(raw):
    rec = _get_refresh_record(raw)
    if rec is not None:
        get_db().child('refresh_tokens').child(_hash_token(raw)).update({'revoked': True})


def revoke_family(family_id):
    tokens = get_db().child('refresh_tokens').get() or {}
    for h, rec in tokens.items():
        if isinstance(rec, dict) and rec.get('family_id') == family_id:
            get_db().child(f'refresh_tokens/{h}').update({'revoked': True})


def rotate_refresh_token(raw):
    rec = _get_refresh_record(raw)
    if rec is None:
        return None
    if rec.get('revoked') is True:
        # Reuse detected: a revoked token was presented again. Burn the whole
        # family to invalidate any tokens derived from the compromised chain.
        revoke_family(rec['family_id'])
        raise RefreshTokenReuseError()
    if time.time() > rec.get('expires_at'):
        return None
    # Consume the presented token before minting its replacement.
    get_db().child('refresh_tokens').child(_hash_token(raw)).update({'revoked': True})
    new_raw, _ = create_refresh_token(
        rec['user_id'],
        rec['restaurant_id'],
        rec.get('is_superadmin', False),
        family_id=rec['family_id'],
    )
    return new_raw, rec


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return '', 204

        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(" ")[1]

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            request.user_id = data['sub']
            request.restaurant_id = data['restaurant_id']
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401

        return f(*args, **kwargs)

    return decorated
