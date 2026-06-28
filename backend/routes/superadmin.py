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

@superadmin_bp.route('/superadmin/create-restaurant', methods=['POST'])
@token_required
def create_restaurant_admin():
    db_ref = get_db()
    data = request.get_json()
    
    # Extract data
    res_name = data.get('restaurant_name')
    owner_name = data.get('owner_name')
    email = data.get('email')
    password = data.get('password')
    
    if not all([res_name, owner_name, email, password]):
        return jsonify({'message': 'Missing fields'}), 400
        
    # Check if exists
    exists = db_ref.child('users').order_by_child('email').equal_to(email).get()
    if exists:
        return jsonify({'message': 'Email already exists'}), 400
        
    # 1. Create Restaurant
    res_ref = db_ref.child('restaurants').push({
        'name': res_name,
        'created_at': time.time()
    })
    rid = res_ref.key
    
    # 2. Create Admin User
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db_ref.child('users').push({
        'email': email,
        'password': hashed_pw,
        'name': owner_name,
        'restaurant_id': rid,
        'role': 'owner',
        'created_at': time.time()
    })
    
    return jsonify({'message': 'Restaurant and Admin created successfully', 'rid': rid}), 201
