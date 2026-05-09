from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import bcrypt
import time
import random
from firebase_client import get_db
from auth_utils import generate_token, token_required
import smtplib
from email.mime.text import MIMEText

superadmin_bp = Blueprint('superadmin', __name__)

SUPERADMIN_EMAIL = "sanalshijilkk52@gmail.com"

# MFA codes are stored in Firebase so they persist across all Gunicorn workers
def store_mfa_code(email, code):
    db_ref = get_db()
    db_ref.child('mfa_codes').child(email.replace('.', '_')).set({
        'code': code,
        'expires_at': time.time() + 600  # 10 minutes
    })

def get_mfa_code(email):
    db_ref = get_db()
    entry = db_ref.child('mfa_codes').child(email.replace('.', '_')).get()
    if not entry:
        return None
    if time.time() > entry.get('expires_at', 0):
        db_ref.child('mfa_codes').child(email.replace('.', '_')).delete()
        return None
    return entry.get('code')

def clear_mfa_code(email):
    db_ref = get_db()
    db_ref.child('mfa_codes').child(email.replace('.', '_')).delete()

def send_email(target, code):
    sender = "sanalshijilkk52@gmail.com"
    password = "gjsh toil csma aowl" 
    
    msg = MIMEText(f"Your Restobot SuperAdmin Security Code is: {code}\n\nDo not share this code with anyone.")
    msg['Subject'] = 'Restobot | SuperAdmin MFA Verification'
    msg['From'] = f"Restobot System <{sender}>"
    msg['To'] = target

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(sender, password)
            server.sendmail(sender, target, msg.as_string())
        return True
    except Exception as e:
        print(f"Email Error: {e}")
        return False

# Bcrypt hash for 'wervus2000'
SUPERADMIN_HASH = b'$2b$12$cuCI8t7nwl2Ol3CER8vce.uZhgU9w922jT8inRmS17ra81ttI39Ne'

@superadmin_bp.route('/superadmin/login', methods=['POST', 'OPTIONS'])
@cross_origin()
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if email != SUPERADMIN_EMAIL:
        return jsonify({'message': 'Access Denied: Unauthorized Email'}), 403
    
    # Securely verify using Bcrypt
    if bcrypt.checkpw(password.encode('utf-8'), SUPERADMIN_HASH):
        code = str(random.randint(100000, 999999))
        store_mfa_code(email, code)
        success = send_email(email, code)
        if not success:
            return jsonify({'message': 'Failed to send MFA email. Check SMTP config.'}), 500
        return jsonify({'message': 'MFA code sent', 'email': email}), 200
    
    return jsonify({'message': 'Invalid credentials'}), 401

@superadmin_bp.route('/superadmin/verify', methods=['POST', 'OPTIONS'])
@cross_origin()
def verify_mfa():
    data = request.get_json()
    email = data.get('email')
    code = data.get('code')
    
    stored_code = get_mfa_code(email)
    if stored_code and stored_code == code:
        clear_mfa_code(email)
        token = generate_token('superadmin_id', 'all', is_superadmin=True)
        return jsonify({
            'token': token,
            'role': 'superadmin'
        }), 200
    
    return jsonify({'message': 'Invalid or expired MFA code'}), 401

@superadmin_bp.route('/superadmin/create-restaurant', methods=['POST', 'OPTIONS'])
@cross_origin()
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
