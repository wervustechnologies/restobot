from flask import Blueprint, jsonify, request
import time
import time as time_module
from firebase_client import get_db
from auth_utils import token_required
from limiter import limiter, LIMIT_PUBLIC_WRITE

orders_bp = Blueprint('orders', __name__)

def format_list(data_dict):
    if not data_dict: return []
    return [{'id': k, **v} for k, v in data_dict.items()]

@orders_bp.route('/orders', methods=['POST'])
@limiter.limit(LIMIT_PUBLIC_WRITE)
def create_order():
    db_ref = get_db()
    data = request.get_json()

    restaurant_id = data.get('restaurant_id')
    items = data.get('items', [])
    total_amount = data.get('total_amount', 0)
    qr_token = data.get('qr_token')
    guest_id = data.get('guest_id')

    if not restaurant_id:
        return jsonify({'error': 'Missing restaurant_id'}), 400
    if not items:
        return jsonify({'error': 'Missing items'}), 400

    table_number = "Unknown"
    if qr_token:
        table_lookup = db_ref.child(f'table_tokens/{qr_token}').get()
        if table_lookup:
            table_number = table_lookup.get('table_number', "Unknown")

    order_data = {
        'table_number': str(table_number),
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

    if guest_id:
        db_ref.child(f'restaurants/{restaurant_id}/active_carts/{guest_id}').delete()

    return jsonify({'success': True, 'order_id': order_ref.key, 'order': order_data}), 201

@orders_bp.route('/orders/guest/<restaurant_id>/<guest_id>', methods=['GET'])
@limiter.limit(LIMIT_PUBLIC_WRITE)
def get_guest_orders(restaurant_id, guest_id):
    db_ref = get_db()
    orders = format_list(db_ref.child(f'restaurants/{restaurant_id}/orders').get())
    guest_orders = [o for o in orders if o.get('guest_id') == guest_id]
    guest_orders.sort(key=lambda x: x.get('created_at', 0), reverse=True)
    return jsonify(guest_orders), 200

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

@orders_bp.route('/orders/<order_id>', methods=['GET'])
@token_required
def get_order(order_id):
    db_ref = get_db()
    restaurant_id = request.restaurant_id
    order = db_ref.child(f'restaurants/{restaurant_id}/orders/{order_id}').get()
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    return jsonify({'id': order_id, **order}), 200

@orders_bp.route('/orders/<order_id>/claim', methods=['PUT'])
@token_required
def claim_order(order_id):
    db_ref = get_db()
    restaurant_id = request.restaurant_id
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

@orders_bp.route('/orders/<order_id>/add-items', methods=['PUT'])
@token_required
def add_items_to_order(order_id):
    db_ref = get_db()
    restaurant_id = request.restaurant_id
    data = request.get_json()
    new_items = data.get('items', [])

    if not new_items:
        return jsonify({'error': 'No items provided'}), 400

    order = db_ref.child(f'restaurants/{restaurant_id}/orders/{order_id}').get()
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    existing_items = order.get('items', [])
    existing_items.extend(new_items)

    new_total = sum(item.get('price', 0) * item.get('quantity', 1) for item in existing_items)

    db_ref.child(f'restaurants/{restaurant_id}/orders/{order_id}').update({
        'items': existing_items,
        'total_amount': new_total
    })

    return jsonify({'success': True, 'message': 'Items added', 'total_amount': new_total}), 200

@orders_bp.route('/orders/<order_id>/complete', methods=['PUT'])
@token_required
def complete_order(order_id):
    db_ref = get_db()
    restaurant_id = request.restaurant_id

    order = db_ref.child(f'restaurants/{restaurant_id}/orders/{order_id}').get()
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    db_ref.child(f'restaurants/{restaurant_id}/orders/{order_id}').update({
        'status': 'completed',
        'completed_at': time.time()
    })

    return jsonify({'success': True, 'message': 'Order completed'}), 200

@orders_bp.route('/orders/<order_id>/serve', methods=['PUT'])
@token_required
def serve_order(order_id):
    db_ref = get_db()
    restaurant_id = request.restaurant_id

    order = db_ref.child(f'restaurants/{restaurant_id}/orders/{order_id}').get()
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    db_ref.child(f'restaurants/{restaurant_id}/orders/{order_id}').update({
        'status': 'served',
        'served_at': time.time()
    })

    return jsonify({'success': True, 'message': 'Order served'}), 200

@orders_bp.route('/orders/table/<table_number>/lock', methods=['PUT'])
@token_required
def lock_table(table_number):
    db_ref = get_db()
    restaurant_id = request.restaurant_id
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

@orders_bp.route('/orders/table/<table_number>/unlock', methods=['PUT'])
@token_required
def unlock_table(table_number):
    db_ref = get_db()
    restaurant_id = request.restaurant_id
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

@orders_bp.route('/orders/table/<table_number>/dismiss-call', methods=['PUT'])
@token_required
def dismiss_call(table_number):
    db_ref = get_db()
    restaurant_id = request.restaurant_id

    tables = db_ref.child(f'restaurants/{restaurant_id}/tables').get() or {}
    table_id = None
    for tid, tdata in tables.items():
        if str(tdata.get('table_number')) == str(table_number):
            table_id = tid
            break

    if not table_id:
        return jsonify({'error': 'Table not found'}), 404

    db_ref.child(f'restaurants/{restaurant_id}/tables/{table_id}').update({
        'call_waiter': False,
        'call_waiter_at': None
    })

    return jsonify({'success': True, 'message': 'Call dismissed'}), 200

@orders_bp.route('/orders/tables-status', methods=['GET'])
@token_required
def get_tables_with_orders():
    db_ref = get_db()
    restaurant_id = request.restaurant_id
    filter_type = request.args.get('filter', 'completed')

    tables = format_list(db_ref.child(f'restaurants/{restaurant_id}/tables').get())
    # Live status board only needs active orders. RTDB equal_to takes a single
    # value, so issue two small indexed reads for pending + claimed instead of
    # pulling the restaurant's full order history on every poll.
    pending = format_list(db_ref.child(f'restaurants/{restaurant_id}/orders').order_by_child('status').equal_to('pending').get())
    claimed = format_list(db_ref.child(f'restaurants/{restaurant_id}/orders').order_by_child('status').equal_to('claimed').get())
    served = format_list(db_ref.child(f'restaurants/{restaurant_id}/orders').order_by_child('status').equal_to('served').get())
    orders = pending + claimed + served

    if filter_type in ('completed', 'all'):
        completed = format_list(db_ref.child(f'restaurants/{restaurant_id}/orders').order_by_child('status').equal_to('completed').limit_to_last(200).get())
        orders += completed
        
    if filter_type in ('billed', 'all'):
        billed = format_list(db_ref.child(f'restaurants/{restaurant_id}/orders').order_by_child('status').equal_to('billed').limit_to_last(200).get())
        orders += billed

    table_orders = {}
    for table in tables:
        tnum = str(table.get('table_number'))
        table_orders[tnum] = {
            'table_number': tnum,
            'table_id': table.get('id'),
            'locked_by': table.get('locked_by'),
            'locked_by_name': table.get('locked_by_name'),
            'locked_at': table.get('locked_at'),
            'call_waiter': table.get('call_waiter', False),
            'call_waiter_at': table.get('call_waiter_at'),
            'orders': [],
            'total_amount': 0,
            'has_pending': False,
            'has_completed': False,
            'has_billed': False
        }

    for order in orders:
        tnum = str(order.get('table_number'))
        if tnum not in table_orders:
            continue
        table_orders[tnum]['orders'].append(order)
        if order.get('status') in ('pending', 'claimed', 'served'):
            table_orders[tnum]['total_amount'] += order.get('total_amount', 0)
            table_orders[tnum]['has_pending'] = True
        elif order.get('status') == 'completed':
            table_orders[tnum]['total_amount'] += order.get('total_amount', 0)
            table_orders[tnum]['has_completed'] = True
        elif order.get('status') == 'billed':
            table_orders[tnum]['total_amount'] += order.get('total_amount', 0)
            table_orders[tnum]['has_billed'] = True

    result = [v for v in table_orders.values()]
    result.sort(key=lambda x: int(x['table_number']) if x['table_number'].isdigit() else 0)

    return jsonify(result), 200

@orders_bp.route('/orders/table/<table_number>/bill', methods=['PUT'])
@token_required
def bill_table(table_number):
    db_ref = get_db()
    restaurant_id = request.restaurant_id

    tables = db_ref.child(f'restaurants/{restaurant_id}/tables').get() or {}
    table_id = None
    for tid, tdata in tables.items():
        if str(tdata.get('table_number')) == str(table_number):
            table_id = tid
            break

    if not table_id:
        return jsonify({'error': 'Table not found'}), 404

    orders_ref = db_ref.child(f'restaurants/{restaurant_id}/orders')
    orders = []
    for st in ['pending', 'claimed', 'served', 'completed']:
        orders.extend(format_list(orders_ref.order_by_child('status').equal_to(st).get()))
    
    table_orders = [o for o in orders if str(o.get('table_number')) == str(table_number)]
    
    updates = {}
    for order in table_orders:
        if order.get('status') in ['pending', 'claimed', 'served', 'completed']:
            updates[f"restaurants/{restaurant_id}/orders/{order['id']}/status"] = 'billed'
            updates[f"restaurants/{restaurant_id}/orders/{order['id']}/billed_at"] = time.time()
            
    updates[f"restaurants/{restaurant_id}/tables/{table_id}/locked_by"] = None
    updates[f"restaurants/{restaurant_id}/tables/{table_id}/locked_by_name"] = None
    updates[f"restaurants/{restaurant_id}/tables/{table_id}/locked_at"] = None
    updates[f"restaurants/{restaurant_id}/tables/{table_id}/call_waiter"] = False
    updates[f"restaurants/{restaurant_id}/tables/{table_id}/call_waiter_at"] = None

    if updates:
        db_ref.update(updates)

    return jsonify({'success': True, 'message': 'Table billed and cleared'}), 200
