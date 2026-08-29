from flask import Blueprint, request, jsonify, send_file, current_app
from firebase_client import get_db
from auth_utils import token_required
from rec_utils import normalize_recs, normalize_taste
from menu_import import build_import_package, import_workbook, workbook_from_upload, MenuImportError
from pos_adapters import sync_menu_from_pos, sync_tables_from_pos
from pos_providers.petpooja import PetpoojaApiError
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

@admin_bp.route('/admin/main_categories/<id>', methods=['PUT'])
@token_required
def update_main_category(id):
    db_ref = get_db()
    data = request.get_json()
    db_ref.child(f'restaurants/{request.restaurant_id}/main_categories/{id}').update(data)
    return jsonify({'message': 'Main Category updated', 'id': id, 'data': data}), 200

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

@admin_bp.route('/admin/categories/<id>', methods=['PUT'])
@token_required
def update_category(id):
    db_ref = get_db()
    data = request.get_json()
    db_ref.child(f'restaurants/{request.restaurant_id}/categories/{id}').update(data)
    return jsonify({'message': 'Category updated', 'id': id, 'data': data}), 200

@admin_bp.route('/admin/categories/<id>', methods=['DELETE'])
@token_required
def delete_category(id):
    db_ref = get_db()
    db_ref.child(f'restaurants/{request.restaurant_id}/categories/{id}').delete()
    return jsonify({'message': 'Category deleted'}), 200

# --- Main Ingredients (controlled, per-restaurant vocabulary) ---
@admin_bp.route('/admin/ingredients', methods=['GET'])
@token_required
def get_ingredients():
    db_ref = get_db()
    ingredients = db_ref.child(f'restaurants/{request.restaurant_id}/ingredients').get()
    ing_list = format_list(ingredients)
    ing_list.sort(key=lambda x: x.get('display_order', 0))
    return jsonify(ing_list), 200

@admin_bp.route('/admin/ingredients', methods=['POST'])
@token_required
def add_ingredient():
    db_ref = get_db()
    data = request.get_json()
    ing_ref = db_ref.child(f'restaurants/{request.restaurant_id}/ingredients').push(data)
    return jsonify({'id': ing_ref.key, **data}), 201

@admin_bp.route('/admin/ingredients/<id>', methods=['PUT'])
@token_required
def update_ingredient(id):
    db_ref = get_db()
    data = request.get_json()
    db_ref.child(f'restaurants/{request.restaurant_id}/ingredients/{id}').update(data)
    return jsonify({'message': 'Ingredient updated', 'id': id, 'data': data}), 200

@admin_bp.route('/admin/ingredients/<id>', methods=['DELETE'])
@token_required
def delete_ingredient(id):
    db_ref = get_db()
    db_ref.child(f'restaurants/{request.restaurant_id}/ingredients/{id}').delete()
    return jsonify({'message': 'Ingredient deleted'}), 200


# --- Cuisines (optional per-restaurant labels) ---
@admin_bp.route('/admin/cuisines', methods=['GET'])
@token_required
def get_cuisines():
    db_ref = get_db()
    cuisines = db_ref.child(f'restaurants/{request.restaurant_id}/cuisines').get()
    c_list = format_list(cuisines)
    c_list.sort(key=lambda x: x.get('display_order', 0))
    return jsonify(c_list), 200

@admin_bp.route('/admin/cuisines', methods=['POST'])
@token_required
def add_cuisine():
    db_ref = get_db()
    data = request.get_json()
    c_ref = db_ref.child(f'restaurants/{request.restaurant_id}/cuisines').push(data)
    return jsonify({'id': c_ref.key, **data}), 201

@admin_bp.route('/admin/cuisines/<id>', methods=['PUT'])
@token_required
def update_cuisine(id):
    db_ref = get_db()
    data = request.get_json()
    db_ref.child(f'restaurants/{request.restaurant_id}/cuisines/{id}').update(data)
    return jsonify({'message': 'Cuisine updated', 'id': id, 'data': data}), 200

@admin_bp.route('/admin/cuisines/<id>', methods=['DELETE'])
@token_required
def delete_cuisine(id):
    db_ref = get_db()
    db_ref.child(f'restaurants/{request.restaurant_id}/cuisines/{id}').delete()
    return jsonify({'message': 'Cuisine deleted'}), 200


# --- Tastes (optional per-restaurant flavour vocabulary) ---
@admin_bp.route('/admin/tastes', methods=['GET'])
@token_required
def get_tastes():
    db_ref = get_db()
    tastes = db_ref.child(f'restaurants/{request.restaurant_id}/tastes').get()
    t_list = format_list(tastes)
    t_list.sort(key=lambda x: x.get('display_order', 0))
    return jsonify(t_list), 200

@admin_bp.route('/admin/tastes', methods=['POST'])
@token_required
def add_taste():
    db_ref = get_db()
    data = request.get_json()
    if data.get('emoji') is None:
        data['emoji'] = ''
    t_ref = db_ref.child(f'restaurants/{request.restaurant_id}/tastes').push(data)
    return jsonify({'id': t_ref.key, **data}), 201

@admin_bp.route('/admin/tastes/<id>', methods=['PUT'])
@token_required
def update_taste(id):
    db_ref = get_db()
    data = request.get_json()
    db_ref.child(f'restaurants/{request.restaurant_id}/tastes/{id}').update(data)
    return jsonify({'message': 'Taste updated', 'id': id, 'data': data}), 200

@admin_bp.route('/admin/tastes/<id>', methods=['DELETE'])
@token_required
def delete_taste(id):
    db_ref = get_db()
    db_ref.child(f'restaurants/{request.restaurant_id}/tastes/{id}').delete()
    return jsonify({'message': 'Taste deleted'}), 200


# --- Items ---
@admin_bp.route('/admin/items', methods=['GET'])
@token_required
def get_items():
    db_ref = get_db()
    items = db_ref.child(f'restaurants/{request.restaurant_id}/items').get()
    item_list = format_list(items)
    # Read-only normalization: legacy single-string taste -> one-element list.
    for it in item_list:
        it['taste'] = normalize_taste(it.get('taste'))
    return jsonify(item_list), 200

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

# --- Item Recommendations ---
@admin_bp.route('/admin/items/<id>/recommendations', methods=['GET'])
@token_required
def get_item_recommendations(id):
    db_ref = get_db()
    recs = db_ref.child(f'restaurants/{request.restaurant_id}/items/{id}/recommendations').get()
    return jsonify(normalize_recs(recs)), 200

@admin_bp.route('/admin/items/<id>/recommendations', methods=['PUT'])
@token_required
def update_item_recommendations(id):
    db_ref = get_db()
    data = request.get_json()
    db_ref.child(f'restaurants/{request.restaurant_id}/items/{id}/recommendations').set(data)
    return jsonify({'message': 'Recommendations updated'}), 200

# --- Menu Excel Import ---
@admin_bp.route('/admin/menu/template', methods=['GET'])
@token_required
def download_menu_template():
    # Bundle the blank template + an instruction guide into one ZIP so the user
    # gets both files in a single download.
    package = build_import_package()
    return send_file(
        package,
        as_attachment=True,
        download_name='menu-import-template.zip',
        mimetype='application/zip',
    ), 200

@admin_bp.route('/admin/menu/import', methods=['POST'])
@token_required
def import_menu():
    db_ref = get_db()
    file = request.files.get('file')
    if not file or not file.filename:
        return jsonify({'error': 'No file uploaded. Please choose an .xlsx file.'}), 400
    try:
        wb = workbook_from_upload(file)
    except MenuImportError:
        return jsonify({'error': 'Could not read the file. Upload the .xlsx from the template (a .zip is also accepted).'}), 400

    try:
        report = import_workbook(db_ref, request.restaurant_id, wb)
    except MenuImportError as e:
        return jsonify({'error': str(e)}), 400

    if report['total'] == 0:
        return jsonify({'error': 'No data rows found in the file.'}), 400
    if report['added'] == 0:
        # Everything failed -> 4xx, but still return the report so the UI can
        # show exactly which rows failed.
        return jsonify(report), 400
    return jsonify(report), 200

# --- Menu Fetch from POS ---
@admin_bp.route('/admin/menu/fetch-pos', methods=['POST'])
@token_required
def fetch_menu_from_pos():
    db_ref = get_db()
    try:
        report = sync_menu_from_pos(db_ref, request.restaurant_id)
    except ValueError as e:
        # No POS configured / incomplete credentials.
        return jsonify({'error': str(e)}), 400
    except PetpoojaApiError as e:
        # Petpooja unreachable or returned garbage — our side is fine, theirs is not.
        current_app.logger.error('fetch-pos failed for restaurant %s: %s', request.restaurant_id, e)
        return jsonify({'error': str(e)}), 502
    return jsonify(report), 200

# --- Tables Fetch from POS ---
@admin_bp.route('/admin/tables/fetch-pos', methods=['POST'])
@token_required
def fetch_tables_from_pos():
    db_ref = get_db()
    try:
        report = sync_tables_from_pos(db_ref, request.restaurant_id)
    except ValueError as e:
        # No POS configured / incomplete credentials.
        return jsonify({'error': str(e)}), 400
    except PetpoojaApiError as e:
        current_app.logger.error('tables fetch-pos failed for restaurant %s: %s', request.restaurant_id, e)
        return jsonify({'error': str(e)}), 502
    return jsonify(report), 200

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

    # Prevent duplicate table numbers within the same restaurant
    tables_snapshot = db_ref.child(f'restaurants/{request.restaurant_id}/tables').get()
    tables = tables_snapshot or {}
    for existing in tables.values():
        if str(existing.get('table_number')) == str(table_num):
            return jsonify({'error': f'Table {table_num} already exists in this restaurant'}), 409

    table_data = {
        'table_number': table_num,
        'qr_token': token
    }
    table_ref = db_ref.child(f'restaurants/{request.restaurant_id}/tables').push(table_data)

    # Also add to a global lookup for easy QR scanning
    db_ref.child(f'table_tokens/{token}').set({
        'restaurant_id': request.restaurant_id,
        'table_number': table_num,
        'table_id': table_ref.key
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
