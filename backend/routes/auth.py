from flask import Blueprint, request, jsonify
import bcrypt
import time
from firebase_client import get_db
from auth_utils import generate_token, token_required

auth_bp = Blueprint('auth', __name__)

# Public registration is disabled. Use SuperAdmin Panel.

@auth_bp.route('/auth/login', methods=['POST'])
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
        
        # Get restaurant info
        res = db_ref.child(f"restaurants/{user['restaurant_id']}").get()
        
        return jsonify({
            'token': token,
            'restaurant_id': user['restaurant_id'],
            'user': {
                'email': email,
                'name': user['name'],
                'restaurant_name': res.get('name')
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
        'password_plain': password,
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

    users = db_ref.child('users').get() or {}
    waiters = []
    for uid, udata in users.items():
        if udata.get('restaurant_id') == request.restaurant_id and udata.get('role') == 'waiter':
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

        return jsonify({
            'token': token,
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
