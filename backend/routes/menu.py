from flask import Blueprint, jsonify, request
from firebase_client import get_db
from limiter import limiter, LIMIT_AI, LIMIT_PUBLIC_READ

menu_bp = Blueprint('menu', __name__)

def format_list(data_dict):
    if not data_dict: return []
    return [{'id': k, **v} for k, v in data_dict.items()]

@menu_bp.route('/menu/<restaurant_id>', methods=['GET'])
@limiter.limit(LIMIT_PUBLIC_READ)
def get_menu(restaurant_id):
    db_ref = get_db()
    
    # Get all restaurant data in one call
    res_data = db_ref.child(f'restaurants/{restaurant_id}').get()
    if not res_data:
        return jsonify({'error': 'Restaurant not found'}), 404
        
    main_cats = format_list(res_data.get('main_categories'))
    main_cats.sort(key=lambda x: x.get('display_order', 0))
    
    cats = format_list(res_data.get('categories'))
    cats.sort(key=lambda x: x.get('display_order', 0))
    
    items = format_list(res_data.get('items'))
    
    main_categories = []
    for mc in main_cats:
        mc_id = mc['id']
        mc_sub_cats = []
        for cat in cats:
            if cat.get('main_category_id') == mc_id:
                cat_id = cat['id']
                cat_items = [i for i in items if i.get('category_id') == cat_id]
                
                # Sort items by priority: high > medium > low
                priority_map = {'high': 3, 'medium': 2, 'low': 1}
                cat_items.sort(key=lambda x: priority_map.get(x.get('priority', 'medium'), 2), reverse=True)

                mc_sub_cats.append({
                    'id': cat_id,
                    'name': cat.get('name'),
                    'course_type': cat.get('course_type'),
                    'items': cat_items
                })
        main_categories.append({
            'id': mc_id,
            'name': mc.get('name'),
            'categories': mc_sub_cats
        })
        
    # Handle categories with no main_category_id (legacy data)
    unassigned_cats = [c for c in cats if not c.get('main_category_id')]
    if unassigned_cats:
        other_sub_cats = []
        for cat in unassigned_cats:
            cat_id = cat['id']
            cat_items = [i for i in items if i.get('category_id') == cat_id]
            
            # Sort items by priority: high > medium > low
            priority_map = {'high': 3, 'medium': 2, 'low': 1}
            cat_items.sort(key=lambda x: priority_map.get(x.get('priority', 'medium'), 2), reverse=True)

            other_sub_cats.append({
                'id': cat_id,
                'name': cat.get('name'),
                'items': cat_items
            })
        main_categories.append({
            'id': 'legacy-other',
            'name': 'Other',
            'categories': other_sub_cats
        })
        
    return jsonify({
        'restaurant': {
            'id': restaurant_id,
            'name': res_data.get('name'),
            'address': res_data.get('address'),
            'review_link': res_data.get('review_link', '')
        },
        'main_categories': main_categories
    }), 200

@menu_bp.route('/menu/<restaurant_id>/recommend', methods=['POST'])
@limiter.limit(LIMIT_AI)
def recommend_items(restaurant_id):
    db_ref = get_db()
    prefs = request.get_json()
    
    items_dict = db_ref.child(f'restaurants/{restaurant_id}/items').get()
    items = format_list(items_dict)
    
    scored_items = []
    for item in items:
        score = 0
        if item.get('item_type') == prefs.get('item_type'):
            score += 5
        pref_spice = prefs.get('spice_level', 3)
        if abs(item.get('spice_level', 3) - pref_spice) <= 1:
            score += 3
        if item.get('heaviness') == prefs.get('heaviness'):
            score += 2
        if item.get('is_bestseller'):
            score += 2
        scored_items.append({**item, 'match_score': score})
        
    recommendations = sorted(scored_items, key=lambda x: x['match_score'], reverse=True)[:3]
    return jsonify(recommendations), 200
