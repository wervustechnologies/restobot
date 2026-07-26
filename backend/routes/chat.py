from flask import Blueprint, request, jsonify
from firebase_client import get_db
from limiter import limiter, LIMIT_AI

chat_bp = Blueprint('chat', __name__)

def format_list(data_dict):
    if not data_dict: return []
    return [{'id': k, **v} for k, v in data_dict.items()]

@chat_bp.route('/chat/suggest', methods=['POST'])
@limiter.limit(LIMIT_AI)
def suggest_item():
    data = request.get_json()
    restaurant_id = data.get('restaurant_id')
    current_item = data.get('current_item', {})
    course_type = data.get('course_type', '')

    if not restaurant_id or not current_item:
        return jsonify({'error': 'Missing required fields'}), 400

    db_ref = get_db()
    res_data = db_ref.child(f'restaurants/{restaurant_id}').get()
    if not res_data:
        return jsonify({'error': 'Restaurant not found'}), 404

    items = format_list(res_data.get('items'))
    active_items = [i for i in items if i.get('is_enabled') is not False]

    current_id = str(current_item.get('id', ''))

    # Check for admin-defined food recommendations on the current item
    recs = res_data.get('items', {}).get(current_id, {}).get('recommendations', {})
    food_recs = recs.get('food_items', {})
    if food_recs:
        candidates = []
        for rec_id, rec_data in food_recs.items():
            match = next((i for i in active_items if str(i.get('id', '')) == rec_id), None)
            if match:
                priority_score = {'high': 3, 'medium': 2, 'low': 1}.get(rec_data.get('priority', 'medium'), 2)
                candidates.append({**match, 'score': priority_score})
        candidates.sort(key=lambda x: x.get('score', 0), reverse=True)
        best = candidates[0] if candidates else None
        if best:
            return jsonify({
                'suggestion': best,
                'message': f"If you liked {current_item.get('name', 'that')}, you might also enjoy our <b>{best['name']}</b>!"
            }), 200

    # Fallback: hardcoded matching logic
    current_spice = current_item.get('spice_level', 3)
    current_type = current_item.get('item_type', 'non-veg')

    categories = format_list(res_data.get('categories'))
    current_cat_id = None
    for cat in categories:
        if cat.get('course_type', '').lower() == course_type.lower():
            current_cat_id = cat.get('id')
            break

    suggestions = []
    for item in active_items:
        if str(item.get('id', '')) == current_id:
            continue
        if item.get('category_id') != current_cat_id:
            continue
        if item.get('item_type') != current_type:
            continue
        spice_diff = abs((item.get('spice_level', 3) or 3) - (current_spice or 3))
        if spice_diff > 1:
            continue
        priority_score = {'high': 3, 'medium': 2, 'low': 1}.get(item.get('priority', 'medium'), 2)
        if item.get('is_bestseller'):
            priority_score += 1
        suggestions.append({**item, 'score': priority_score})

    suggestions.sort(key=lambda x: x.get('score', 0), reverse=True)
    best = suggestions[0] if suggestions else None

    if best:
        return jsonify({
            'suggestion': best,
            'message': f"If you liked {current_item.get('name', 'that')}, you might also enjoy our <b>{best['name']}</b>!"
        }), 200

    return jsonify({'suggestion': None, 'message': ''}), 200

@chat_bp.route('/chat/evaluate', methods=['POST'])
@limiter.limit(LIMIT_AI)
def evaluate_meal():
    data = request.get_json()
    restaurant_id = data.get('restaurant_id')
    selections = data.get('selections', {})

    if not restaurant_id:
        return jsonify({'error': 'Restaurant ID required'}), 400

    db_ref = get_db()
    res_data = db_ref.child(f'restaurants/{restaurant_id}').get()
    if not res_data:
        return jsonify({'error': 'Restaurant not found'}), 404

    items = format_list(res_data.get('items'))
    active_items = [i for i in items if i.get('is_enabled') is not False]

    selected_items = [v for v in selections.values() if v]
    if not selected_items:
        return jsonify({'suggestion': None, 'suggestion_text': ''}), 200

    selected_ids = {str(v.get('id', '')) for v in selected_items}

    # Check for admin-defined beverage recommendations across all selected items
    beverage_candidates = []
    for v in selected_items:
        sel_id = str(v.get('id', ''))
        recs = res_data.get('items', {}).get(sel_id, {}).get('recommendations', {})
        bev_recs = recs.get('beverages', {})
        for rec_id, rec_data in bev_recs.items():
            if rec_id in selected_ids:
                continue
            match = next((i for i in active_items if str(i.get('id', '')) == rec_id), None)
            if match:
                priority_score = {'high': 3, 'medium': 2, 'low': 1}.get(rec_data.get('priority', 'medium'), 2)
                beverage_candidates.append({**match, 'score': priority_score})

    if beverage_candidates:
        beverage_candidates.sort(key=lambda x: x.get('score', 0), reverse=True)
        best = beverage_candidates[0]
        selected_names = ', '.join([v.get('name', '') for v in selected_items])
        return jsonify({
            'suggestion': best,
            'suggestion_text': f"Along with {selected_names}, our <b>{best['name']}</b> would be a perfect combination!"
        }), 200

    # Fallback: hardcoded matching logic
    categories = format_list(res_data.get('categories'))

    selected_types = {v.get('item_type', 'non-veg') for v in selected_items}
    preferred_type = 'non-veg' if 'non-veg' in selected_types else 'veg'

    selected_course_types = set()
    for v in selected_items:
        cat_id = v.get('category_id')
        for cat in categories:
            if cat.get('id') == cat_id and cat.get('course_type'):
                selected_course_types.add(cat['course_type'].lower())

    candidates = []
    for item in active_items:
        if str(item.get('id', '')) in selected_ids:
            continue
        if item.get('item_type') != preferred_type:
            continue
        item_cat_id = item.get('category_id')
        item_course_type = ''
        for cat in categories:
            if cat.get('id') == item_cat_id:
                item_course_type = cat.get('course_type', '').lower()
                break
        if item_course_type in selected_course_types:
            continue
        priority_score = {'high': 3, 'medium': 2, 'low': 1}.get(item.get('priority', 'medium'), 2)
        if item.get('is_bestseller'):
            priority_score += 1
        candidates.append({**item, 'score': priority_score, 'course_type': item_course_type})

    candidates.sort(key=lambda x: x.get('score', 0), reverse=True)
    best = candidates[0] if candidates else None

    if best:
        selected_names = ', '.join([v.get('name', '') for v in selected_items])
        return jsonify({
            'suggestion': best,
            'suggestion_text': f"Along with {selected_names}, our <b>{best['name']}</b> would be a perfect combination!"
        }), 200

    return jsonify({'suggestion': None, 'suggestion_text': ''}), 200
