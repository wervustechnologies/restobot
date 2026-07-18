from flask import Blueprint, jsonify, request
import time
from firebase_client import get_db
from limiter import limiter, LIMIT_PUBLIC_READ, LIMIT_PUBLIC_WRITE

wishlist_bp = Blueprint('wishlist', __name__)

def format_list(data_dict):
    if not data_dict: return []
    return [{'id': k, **v} for k, v in data_dict.items()]

@wishlist_bp.route('/wishlist', methods=['POST'])
@limiter.limit(LIMIT_PUBLIC_WRITE)
def save_wishlist():
    db_ref = get_db()
    data = request.get_json()
    
    qr_token = data.get('qr_token')
    restaurant_id = data.get('restaurant_id')
    items = data.get('items', [])
    
    if not restaurant_id or not items:
        return jsonify({'error': 'Missing required fields'}), 400
        
    # Optional: Verify table if token is provided
    table_num = "Unknown"
    if qr_token:
        table_lookup = db_ref.child(f'table_tokens/{qr_token}').get()
        if table_lookup:
            table_num = table_lookup.get('table_number', "Unknown")
    
    # Create wishlist entry
    wishlist_data = {
        'table_number': table_num,
        'items': items,
        'total_amount': data.get('total_amount', 0),
        'created_at': time.time(),
        'type': 'wishlist'
    }
    
    wishlist_ref = db_ref.child(f'restaurants/{restaurant_id}/wishlists').push(wishlist_data)
    
    return jsonify({'success': True, 'wishlist_id': wishlist_ref.key}), 201

@wishlist_bp.route('/wishlist/<restaurant_id>/<wishlist_id>', methods=['GET'])
@limiter.limit(LIMIT_PUBLIC_READ)
def get_wishlist(restaurant_id, wishlist_id):
    db_ref = get_db()
    wishlist = db_ref.child(f'restaurants/{restaurant_id}/wishlists/{wishlist_id}').get()
    if not wishlist:
        return jsonify({'error': 'Wishlist not found'}), 404
    return jsonify({'id': wishlist_id, **wishlist}), 200

@wishlist_bp.route('/cart', methods=['POST'])
@limiter.limit(LIMIT_PUBLIC_WRITE)
def save_draft_cart():
    db_ref = get_db()
    data = request.get_json()
    rid = data.get('restaurant_id')
    gid = data.get('guest_id')
    cart = data.get('cart', {})
    
    if not rid or not gid:
        return jsonify({'error': 'Missing rid or gid'}), 400
        
    db_ref.child(f'restaurants/{rid}/active_carts/{gid}').set(cart)
    return jsonify({'success': True}), 200

@wishlist_bp.route('/cart/<rid>/<gid>', methods=['GET'])
@limiter.limit(LIMIT_PUBLIC_READ)
def get_draft_cart(rid, gid):
    db_ref = get_db()
    cart = db_ref.child(f'restaurants/{rid}/active_carts/{gid}').get()
    return jsonify(cart or {}), 200
