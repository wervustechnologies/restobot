from flask import Blueprint, request, jsonify
import bcrypt
import time
from firebase_client import get_db
from auth_utils import (
    generate_token,
    generate_access_token,
    token_required,
    create_refresh_token,
    rotate_refresh_token,
    revoke_refresh_token,
    RefreshTokenReuseError,
)
from limiter import limiter, LIMIT_AUTH
from settings import settings

auth_bp = Blueprint('auth', __name__)

# Public registration is disabled. Use SuperAdmin Panel.

@auth_bp.route('/auth/login', methods=['POST'])
@limiter.limit(LIMIT_AUTH)
def login():
    db_ref = get_db()
    data = request.get_json()
    
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'message': 'Email and password required'}), 400
        
    user_query = db_ref.child('users').order_by_child('email').equal_to(email).get()
    if not user_query:
        return jsonify({'message': 'Invalid credentials'}), 401
        
    # user_query is a dict {uid: {data}}
    user_id = list(user_query.keys())[0]
    user = user_query[user_id]

    if user.get('role') == 'waiter':
        return jsonify({'message': 'Waiters must use the Waiter Login page'}), 403
    
    if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        token = generate_token(user_id, user['restaurant_id'])
        refresh_raw, _ = create_refresh_token(user_id, user['restaurant_id'], is_superadmin=False)

        # Get restaurant info
        res = db_ref.child(f"restaurants/{user['restaurant_id']}").get()

        return jsonify({
            'token': token,
            'refresh_token': refresh_raw,
            'restaurant_id': user['restaurant_id'],
            'user': {
                'email': email,
                'name': user['name'],
                'restaurant_name': res.get('name'),
                'role': user.get('role', 'owner')
            }
        }), 200
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

@auth_bp.route('/auth/register-waiter', methods=['POST'])
@token_required
def register_waiter():
    db_ref = get_db()
    data = request.get_json()

    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    if not all([name, email, password]):
        return jsonify({'message': 'Name, email, and password are required'}), 400

    exists = db_ref.child('users').order_by_child('email').equal_to(email).get()
    if exists:
        return jsonify({'message': 'Email already exists'}), 400

    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    user_ref = db_ref.child('users').push({
        'email': email,
        'password': hashed_pw,
        'name': name,
        'restaurant_id': request.restaurant_id,
        'role': 'waiter',
        'created_at': time.time()
    })

    return jsonify({'message': 'Waiter registered successfully', 'user_id': user_ref.key}), 201

@auth_bp.route('/auth/waiters', methods=['GET'])
@token_required
def list_waiters():
    db_ref = get_db()

    # Index on users/restaurant_id scopes the read server-side. RTDB cannot
    # compound-query two fields, so the role filter stays in Python; the
    # per-restaurant user set is small.
    users = db_ref.child('users').order_by_child('restaurant_id').equal_to(request.restaurant_id).get() or {}
    waiters = []
    for uid, udata in users.items():
        if udata.get('role') == 'waiter':
            waiters.append({
                'id': uid,
                'name': udata.get('name', ''),
                'email': udata.get('email', ''),
                'created_at': udata.get('created_at')
            })

    waiters.sort(key=lambda x: x.get('created_at', 0), reverse=True)
    return jsonify(waiters), 200

@auth_bp.route('/auth/waiters/<waiter_id>', methods=['DELETE'])
@token_required
def delete_waiter(waiter_id):
    db_ref = get_db()

    user = db_ref.child(f'users/{waiter_id}').get()
    if not user:
        return jsonify({'message': 'User not found'}), 404

    if user.get('restaurant_id') != request.restaurant_id:
        return jsonify({'message': 'Unauthorized'}), 403

    if user.get('role') != 'waiter':
        return jsonify({'message': 'Can only delete waiters'}), 400

    db_ref.child(f'users/{waiter_id}').delete()
    return jsonify({'message': 'Waiter deleted'}), 200

@auth_bp.route('/auth/waiter-login', methods=['POST'])
@limiter.limit(LIMIT_AUTH)
def waiter_login():
    db_ref = get_db()
    data = request.get_json()

    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'message': 'Email and password required'}), 400

    user_query = db_ref.child('users').order_by_child('email').equal_to(email).get()
    if not user_query:
        return jsonify({'message': 'Invalid credentials'}), 401

    user_id = list(user_query.keys())[0]
    user = user_query[user_id]

    if user.get('role') != 'waiter':
        return jsonify({'message': 'Not a waiter account'}), 403

    if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        token = generate_token(user_id, user['restaurant_id'])
        refresh_raw, _ = create_refresh_token(user_id, user['restaurant_id'], is_superadmin=False)

        return jsonify({
            'token': token,
            'refresh_token': refresh_raw,
            'restaurant_id': user['restaurant_id'],
            'user': {
                'id': user_id,
                'email': email,
                'name': user['name'],
                'role': 'waiter'
            }
        }), 200
    else:
        return jsonify({'message': 'Invalid credentials'}), 401


@auth_bp.route('/auth/refresh', methods=['POST'])
@limiter.limit(LIMIT_AUTH)
def refresh():
    data = request.get_json() or {}
    raw = data.get('refresh_token')
    if not raw:
        return jsonify({'message': 'Refresh token required'}), 400
    try:
        rotated = rotate_refresh_token(raw)
    except RefreshTokenReuseError:
        return jsonify({'message': 'Invalid or expired refresh token'}), 401
    if not rotated:
        return jsonify({'message': 'Invalid or expired refresh token'}), 401
    new_raw, rec = rotated
    access = generate_access_token(rec['user_id'], rec['restaurant_id'], rec.get('is_superadmin', False))
    return jsonify({
        'token': access,
        'refresh_token': new_raw,
        'expires_in': settings.access_token_expires_minutes * 60,
    }), 200


@auth_bp.route('/auth/logout', methods=['POST'])
@token_required
def logout():
    data = request.get_json() or {}
    raw = data.get('refresh_token')
    if raw:
        revoke_refresh_token(raw)
    return jsonify({'message': 'Logged out'}), 200
