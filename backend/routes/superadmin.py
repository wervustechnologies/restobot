from flask import Blueprint, request, jsonify
import bcrypt
import time
from firebase_client import get_db
from auth_utils import generate_token, token_required

superadmin_bp = Blueprint('superadmin', __name__)

SUPERADMIN_EMAIL = "sanalshijilkk52@gmail.com"
SUPERADMIN_HASH = b'$2b$12$cuCI8t7nwl2Ol3CER8vce.uZhgU9w922jT8inRmS17ra81ttI39Ne'

@superadmin_bp.route('/superadmin/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if email != SUPERADMIN_EMAIL:
        return jsonify({'message': 'Access Denied: Unauthorized Email'}), 403
    
    if bcrypt.checkpw(password.encode('utf-8'), SUPERADMIN_HASH):
        token = generate_token('superadmin_id', 'all', is_superadmin=True)
        return jsonify({
            'token': token,
            'role': 'superadmin'
        }), 200
    
    return jsonify({'message': 'Invalid credentials'}), 401

@superadmin_bp.route('/superadmin/restaurants', methods=['GET'])
@token_required
def list_restaurants():
    db_ref = get_db()
    restaurants = db_ref.child('restaurants').get() or {}
    users = db_ref.child('users').get() or {}

    user_list = []
    for uid, udata in users.items():
        user_list.append({**udata, 'uid': uid})

    result = []
    for rid, rdata in restaurants.items():
        admin = next((u for u in user_list if u.get('restaurant_id') == rid), None)
        result.append({
            'rid': rid,
            'name': rdata.get('name', ''),
            'created_at': rdata.get('created_at'),
            'admin': {
                'uid': admin.get('uid') if admin else None,
                'name': admin.get('name', '') if admin else '',
                'email': admin.get('email', '') if admin else '',
                'password_plain': admin.get('password_plain', '') if admin else '',
                'created_at': admin.get('created_at') if admin else None,
            } if admin else None
        })

    return jsonify(result), 200

@superadmin_bp.route('/superadmin/create-restaurant', methods=['POST'])
@token_required
def create_restaurant_admin():
    db_ref = get_db()
    data = request.get_json()

    res_name = data.get('restaurant_name')
    owner_name = data.get('owner_name')
    email = data.get('email')
    password = data.get('password')

    if not all([res_name, owner_name, email, password]):
        return jsonify({'message': 'Missing fields'}), 400

    exists = db_ref.child('users').order_by_child('email').equal_to(email).get()
    if exists:
        return jsonify({'message': 'Email already exists'}), 400

    res_ref = db_ref.child('restaurants').push({
        'name': res_name,
        'created_at': time.time()
    })
    rid = res_ref.key

    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db_ref.child('users').push({
        'email': email,
        'password': hashed_pw,
        'password_plain': password,
        'name': owner_name,
        'restaurant_id': rid,
        'role': 'owner',
        'created_at': time.time()
    })

    return jsonify({'message': 'Restaurant and Admin created successfully', 'rid': rid}), 201

@superadmin_bp.route('/superadmin/restaurant/<rid>', methods=['PUT'])
@token_required
def update_restaurant(rid):
    db_ref = get_db()
    data = request.get_json()

    res_name = data.get('restaurant_name')
    owner_name = data.get('owner_name')
    email = data.get('email')
    password = data.get('password')

    if not all([res_name, owner_name, email]):
        return jsonify({'message': 'Missing fields'}), 400

    db_ref.child('restaurants').child(rid).update({'name': res_name})

    users = db_ref.child('users').get() or {}
    admin_uid = None
    for uid, udata in users.items():
        if udata.get('restaurant_id') == rid:
            admin_uid = uid
            break

    if admin_uid:
        update_data = {'name': owner_name, 'email': email}
        if password:
            update_data['password'] = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            update_data['password_plain'] = password
        db_ref.child('users').child(admin_uid).update(update_data)
    else:
        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8') if password else ''
        db_ref.child('users').push({
            'email': email,
            'password': hashed_pw,
            'password_plain': password if password else '',
            'name': owner_name,
            'restaurant_id': rid,
            'role': 'owner',
            'created_at': time.time()
        })

    return jsonify({'message': 'Restaurant updated successfully'}), 200

@superadmin_bp.route('/superadmin/restaurant/<rid>', methods=['DELETE'])
@token_required
def delete_restaurant(rid):
    db_ref = get_db()

    db_ref.child('restaurants').child(rid).delete()

    users = db_ref.child('users').get() or {}
    for uid, udata in users.items():
        if udata.get('restaurant_id') == rid:
            db_ref.child('users').child(uid).delete()

    for child_name in ['main_categories', 'categories', 'items', 'tables', 'wishlists', 'active_carts']:
        db_ref.child('restaurants').child(rid).child(child_name).delete()

    return jsonify({'message': 'Restaurant and all related data deleted'}), 200
