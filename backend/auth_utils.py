import jwt
import datetime
import bcrypt
from functools import wraps
from flask import request, jsonify
from firebase_client import get_db

import os

SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'restobot-super-secret-key-local-dev')

def generate_token(user_id, restaurant_id, is_superadmin=False):
    payload = {
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1),
        'iat': datetime.datetime.utcnow(),
        'sub': user_id,
        'restaurant_id': restaurant_id,
        'is_superadmin': is_superadmin
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

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
