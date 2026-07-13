from flask import Blueprint, jsonify, request
import time
from firebase_client import get_db
from auth_utils import token_required

orders_bp = Blueprint('orders', __name__)

def format_list(data_dict):
    if not data_dict: return []
    return [{'id': k, **v} for k, v in data_dict.items()]

@orders_bp.route('/orders', methods=['POST'])
def create_order():
    db_ref = get_db()
    data = request.get_json()

    restaurant_id = data.get('restaurant_id')
    items = data.get('items', [])
    total_amount = data.get('total_amount', 0)
    qr_token = data.get('qr_token')
    guest_id = data.get('guest_id')

    if not restaurant_id or not items:
        return jsonify({'error': 'Missing required fields'}), 400

    table_number = "Unknown"
    if qr_token:
        table_lookup = db_ref.child(f'table_tokens/{qr_token}').get()
        if table_lookup:
            table_number = table_lookup.get('table_number', "Unknown")

    order_data = {
        'table_number': table_number,
        'items': items,
        'total_amount': total_amount,
        'guest_id': guest_id or '',
        'status': 'pending',
        'claimed_by': None,
        'claimed_by_name': None,
        'created_at': time.time(),
        'claimed_at': None
    }

    order_ref = db_ref.child(f'restaurants/{restaurant_id}/orders').push(order_data)

    return jsonify({'success': True, 'order_id': order_ref.key, 'order': order_data}), 201

@orders_bp.route('/orders/<restaurant_id>', methods=['GET'])
@token_required
def get_orders(restaurant_id):
    db_ref = get_db()
    status_filter = request.args.get('status')

    orders_ref = db_ref.child(f'restaurants/{restaurant_id}/orders')
    if status_filter:
        orders_ref = orders_ref.order_by_child('status').equal_to(status_filter)

    orders = orders_ref.get()
    order_list = format_list(orders)
    order_list.sort(key=lambda x: x.get('created_at', 0), reverse=True)

    return jsonify(order_list), 200

@orders_bp.route('/orders/<restaurant_id>/<order_id>', methods=['GET'])
@token_required
def get_order(restaurant_id, order_id):
    db_ref = get_db()
    order = db_ref.child(f'restaurants/{restaurant_id}/orders/{order_id}').get()
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    return jsonify({'id': order_id, **order}), 200

@orders_bp.route('/orders/<restaurant_id>/<order_id>/claim', methods=['PUT'])
@token_required
def claim_order(restaurant_id, order_id):
    db_ref = get_db()
    data = request.get_json()
    waiter_id = data.get('waiter_id')
    waiter_name = data.get('waiter_name')

    if not waiter_id:
        return jsonify({'error': 'Missing waiter_id'}), 400

    order = db_ref.child(f'restaurants/{restaurant_id}/orders/{order_id}').get()
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    if order.get('status') == 'claimed' and order.get('claimed_by') != waiter_id:
        return jsonify({'error': 'Order already claimed by another waiter'}), 409

    db_ref.child(f'restaurants/{restaurant_id}/orders/{order_id}').update({
        'status': 'claimed',
        'claimed_by': waiter_id,
        'claimed_by_name': waiter_name,
        'claimed_at': time.time()
    })

    return jsonify({'success': True, 'message': 'Order claimed successfully'}), 200

@orders_bp.route('/orders/<restaurant_id>/<order_id>/complete', methods=['PUT'])
@token_required
def complete_order(restaurant_id, order_id):
    db_ref = get_db()

    order = db_ref.child(f'restaurants/{restaurant_id}/orders/{order_id}').get()
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    db_ref.child(f'restaurants/{restaurant_id}/orders/{order_id}').update({
        'status': 'completed',
        'completed_at': time.time()
    })

    return jsonify({'success': True, 'message': 'Order completed'}), 200

@orders_bp.route('/orders/<restaurant_id>/table/<table_number>/lock', methods=['PUT'])
@token_required
def lock_table(restaurant_id, table_number):
    db_ref = get_db()
    data = request.get_json()
    waiter_id = data.get('waiter_id')
    waiter_name = data.get('waiter_name')

    if not waiter_id:
        return jsonify({'error': 'Missing waiter_id'}), 400

    tables = db_ref.child(f'restaurants/{restaurant_id}/tables').get() or {}
    table_id = None
    table_data = None
    for tid, tdata in tables.items():
        if str(tdata.get('table_number')) == str(table_number):
            table_id = tid
            table_data = tdata
            break

    if not table_id:
        return jsonify({'error': 'Table not found'}), 404

    current_lock = db_ref.child(f'restaurants/{restaurant_id}/tables/{table_id}/locked_by').get()
    if current_lock and current_lock != waiter_id:
        return jsonify({'error': 'Table is already being served by another waiter'}), 409

    db_ref.child(f'restaurants/{restaurant_id}/tables/{table_id}').update({
        'locked_by': waiter_id,
        'locked_by_name': waiter_name,
        'locked_at': time.time()
    })

    return jsonify({'success': True, 'message': 'Table locked'}), 200

@orders_bp.route('/orders/<restaurant_id>/table/<table_number>/unlock', methods=['PUT'])
@token_required
def unlock_table(restaurant_id, table_number):
    db_ref = get_db()
    data = request.get_json()
    waiter_id = data.get('waiter_id')

    tables = db_ref.child(f'restaurants/{restaurant_id}/tables').get() or {}
    table_id = None
    for tid, tdata in tables.items():
        if str(tdata.get('table_number')) == str(table_number):
            table_id = tid
            break

    if not table_id:
        return jsonify({'error': 'Table not found'}), 404

    current_lock = db_ref.child(f'restaurants/{restaurant_id}/tables/{table_id}/locked_by').get()
    if current_lock and current_lock != waiter_id:
        return jsonify({'error': 'Cannot unlock table locked by another waiter'}), 403

    db_ref.child(f'restaurants/{restaurant_id}/tables/{table_id}').update({
        'locked_by': None,
        'locked_by_name': None,
        'locked_at': None
    })

    return jsonify({'success': True, 'message': 'Table unlocked'}), 200

@orders_bp.route('/orders/<restaurant_id>/tables-status', methods=['GET'])
@token_required
def get_tables_with_orders(restaurant_id):
    db_ref = get_db()

    tables = format_list(db_ref.child(f'restaurants/{restaurant_id}/tables').get())
    orders = format_list(db_ref.child(f'restaurants/{restaurant_id}/orders').get())

    table_orders = {}
    for table in tables:
        tnum = str(table.get('table_number'))
        table_orders[tnum] = {
            'table_number': tnum,
            'table_id': table.get('id'),
            'locked_by': table.get('locked_by'),
            'locked_by_name': table.get('locked_by_name'),
            'locked_at': table.get('locked_at'),
            'orders': [],
            'total_amount': 0,
            'has_pending': False
        }

    for order in orders:
        tnum = str(order.get('table_number'))
        if tnum not in table_orders:
            table_orders[tnum] = {
                'table_number': tnum,
                'table_id': None,
                'locked_by': None,
                'locked_by_name': None,
                'locked_at': None,
                'orders': [],
                'total_amount': 0,
                'has_pending': False
            }
        table_orders[tnum]['orders'].append(order)
        if order.get('status') in ('pending', 'claimed'):
            table_orders[tnum]['total_amount'] += order.get('total_amount', 0)
            table_orders[tnum]['has_pending'] = True

    result = [v for v in table_orders.values()]
    result.sort(key=lambda x: int(x['table_number']) if x['table_number'].isdigit() else 0)

    return jsonify(result), 200
