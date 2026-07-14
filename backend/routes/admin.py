from flask import Blueprint, request, jsonify
from firebase_client import get_db
from auth_utils import token_required
import uuid
import socket

admin_bp = Blueprint('admin', __name__)

# Helper to format RTDB dicts {id: {data}} to [{id, ...data}]
def format_list(data_dict):
    if not data_dict: return []
    return [{'id': k, **v} for k, v in data_dict.items()]

# --- Restaurant Settings ---
@admin_bp.route('/admin/restaurant', methods=['GET'])
@token_required
def get_restaurant():
    db_ref = get_db()
    res = db_ref.child(f'restaurants/{request.restaurant_id}').get()
    return jsonify(res), 200

@admin_bp.route('/admin/restaurant', methods=['PUT'])
@token_required
def update_restaurant():
    db_ref = get_db()
    data = request.get_json()
    db_ref.child(f'restaurants/{request.restaurant_id}').update(data)
    return jsonify({'message': 'Restaurant updated'}), 200

# --- Main Categories ---
@admin_bp.route('/admin/main_categories', methods=['GET'])
@token_required
def get_main_categories():
    db_ref = get_db()
    main_cats = db_ref.child(f'restaurants/{request.restaurant_id}/main_categories').get()
    mc_list = format_list(main_cats)
    mc_list.sort(key=lambda x: x.get('display_order', 0))
    return jsonify(mc_list), 200

@admin_bp.route('/admin/main_categories', methods=['POST'])
@token_required
def add_main_category():
    db_ref = get_db()
    data = request.get_json()
    mc_ref = db_ref.child(f'restaurants/{request.restaurant_id}/main_categories').push(data)
    return jsonify({'id': mc_ref.key, **data}), 201

@admin_bp.route('/admin/main_categories/<id>', methods=['DELETE'])
@token_required
def delete_main_category(id):
    db_ref = get_db()
    db_ref.child(f'restaurants/{request.restaurant_id}/main_categories/{id}').delete()
    return jsonify({'message': 'Main Category deleted'}), 200


# --- Categories ---
@admin_bp.route('/admin/categories', methods=['GET'])
@token_required
def get_categories():
    db_ref = get_db()
    cats = db_ref.child(f'restaurants/{request.restaurant_id}/categories').get()
    # RTDB doesn't sort by value automatically in .get(), we sort in Python
    cat_list = format_list(cats)
    cat_list.sort(key=lambda x: x.get('display_order', 0))
    return jsonify(cat_list), 200

@admin_bp.route('/admin/categories', methods=['POST'])
@token_required
def add_category():
    db_ref = get_db()
    data = request.get_json()
    cat_ref = db_ref.child(f'restaurants/{request.restaurant_id}/categories').push(data)
    return jsonify({'id': cat_ref.key, **data}), 201

@admin_bp.route('/admin/categories/<id>', methods=['DELETE'])
@token_required
def delete_category(id):
    db_ref = get_db()
    db_ref.child(f'restaurants/{request.restaurant_id}/categories/{id}').delete()
    return jsonify({'message': 'Category deleted'}), 200

# --- Items ---
@admin_bp.route('/admin/items', methods=['GET'])
@token_required
def get_items():
    db_ref = get_db()
    items = db_ref.child(f'restaurants/{request.restaurant_id}/items').get()
    return jsonify(format_list(items)), 200

@admin_bp.route('/admin/items', methods=['POST'])
@token_required
def add_item():
    db_ref = get_db()
    data = request.get_json()
    item_ref = db_ref.child(f'restaurants/{request.restaurant_id}/items').push(data)
    return jsonify({'id': item_ref.key, **data}), 201

@admin_bp.route('/admin/items/<id>', methods=['PUT'])
@token_required
def update_item(id):
    db_ref = get_db()
    data = request.get_json()
    print(f"Updating item {id} with data: {data}")
    db_ref.child(f'restaurants/{request.restaurant_id}/items/{id}').update(data)
    return jsonify({'message': 'Item updated', 'id': id, 'data': data}), 200

@admin_bp.route('/admin/items/<id>', methods=['DELETE'])
@token_required
def delete_item(id):
    db_ref = get_db()
    db_ref.child(f'restaurants/{request.restaurant_id}/items/{id}').delete()
    return jsonify({'message': 'Item deleted'}), 200

# --- Tables ---
@admin_bp.route('/admin/tables', methods=['GET'])
@token_required
def get_tables():
    db_ref = get_db()
    tables = db_ref.child(f'restaurants/{request.restaurant_id}/tables').get()
    return jsonify(format_list(tables)), 200

@admin_bp.route('/admin/tables', methods=['POST'])
@token_required
def add_table():
    db_ref = get_db()
    data = request.get_json()
    table_num = data.get('table_number')
    token = str(uuid.uuid4())
    
    table_data = {
        'table_number': table_num,
        'qr_token': token
    }
    table_ref = db_ref.child(f'restaurants/{request.restaurant_id}/tables').push(table_data)
    
    # Also add to a global lookup for easy QR scanning
    db_ref.child(f'table_tokens/{token}').set({
        'restaurant_id': request.restaurant_id,
        'table_number': table_num
    })
    
    return jsonify({'id': table_ref.key, **table_data}), 201

@admin_bp.route('/admin/tables/<id>', methods=['DELETE'])
@token_required
def delete_table(id):
    db_ref = get_db()
    restaurant_id = request.restaurant_id
    table = db_ref.child(f'restaurants/{restaurant_id}/tables/{id}').get()
    if table:
        table_number = str(table.get('table_number'))
        db_ref.child(f"table_tokens/{table['qr_token']}").delete()
        db_ref.child(f'restaurants/{restaurant_id}/tables/{id}').delete()

        orders = db_ref.child(f'restaurants/{restaurant_id}/orders').get()
        if orders:
            for key, order in orders.items():
                if str(order.get('table_number')) == table_number:
                    db_ref.child(f'restaurants/{restaurant_id}/orders/{key}').delete()
    return jsonify({'message': 'Table and related orders deleted'}), 200

# --- Server Info ---
@admin_bp.route('/admin/server-info', methods=['GET'])
@token_required
def get_server_info():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return jsonify({'local_ip': ip}), 200
