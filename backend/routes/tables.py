from flask import Blueprint, jsonify, request
import time
from firebase_client import get_db
from limiter import limiter, LIMIT_PUBLIC_READ, LIMIT_PUBLIC_WRITE

tables_bp = Blueprint('tables', __name__)

@tables_bp.route('/table/<qr_token>', methods=['GET'])
@limiter.limit(LIMIT_PUBLIC_READ)
def get_table(qr_token):
    db_ref = get_db()
    
    table_lookup = db_ref.child(f'table_tokens/{qr_token}').get()
    
    if not table_lookup:
        return jsonify({'error': 'Table not found'}), 404
    
    return jsonify(table_lookup), 200

def _resolve_table(db_ref, qr_token):
    table_lookup = db_ref.child(f'table_tokens/{qr_token}').get()
    if not table_lookup:
        return None, None, None
    restaurant_id = table_lookup.get('restaurant_id')
    table_id = table_lookup.get('table_id')
    if not restaurant_id or not table_id:
        return None, None, None
    table_data = db_ref.child(f'restaurants/{restaurant_id}/tables/{table_id}').get()
    if not table_data:
        return None, None, None
    return restaurant_id, table_data.get('table_number'), table_id

@tables_bp.route('/table/<qr_token>/lock-status', methods=['GET'])
@limiter.limit(LIMIT_PUBLIC_READ)
def get_table_lock_status(qr_token):
    db_ref = get_db()
    restaurant_id, table_number, table_id = _resolve_table(db_ref, qr_token)
    if not table_id:
        return jsonify({'error': 'Table not found'}), 404

    table_data = db_ref.child(f'restaurants/{restaurant_id}/tables/{table_id}').get()
    if not table_data:
        return jsonify({'error': 'Table data not found'}), 404

    return jsonify({
        'locked_by': table_data.get('locked_by'),
        'locked_by_name': table_data.get('locked_by_name'),
        'locked_at': table_data.get('locked_at'),
        'call_waiter': table_data.get('call_waiter', False),
        'call_waiter_at': table_data.get('call_waiter_at'),
        'table_number': table_number,
        'restaurant_id': restaurant_id
    }), 200

@tables_bp.route('/table/<qr_token>/call-waiter', methods=['POST'])
@limiter.limit(LIMIT_PUBLIC_WRITE)
def call_waiter(qr_token):
    db_ref = get_db()
    restaurant_id, table_number, table_id = _resolve_table(db_ref, qr_token)
    if not table_id:
        return jsonify({'error': 'Table not found'}), 404

    db_ref.child(f'restaurants/{restaurant_id}/tables/{table_id}').update({
        'call_waiter': True,
        'call_waiter_at': time.time()
    })

    return jsonify({'success': True, 'message': 'Waiter has been notified!'}), 200
