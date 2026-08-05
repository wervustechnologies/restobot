from flask import Blueprint, request, jsonify
from firebase_client import get_db
from limiter import limiter, LIMIT_AI
from rec_utils import normalize_recs, normalize_taste

chat_bp = Blueprint('chat', __name__)

def format_list(data_dict):
    if not data_dict: return []
    return [{'id': k, **v} for k, v in data_dict.items()]

def _filter_by_diet(items, diet):
    # 'mixed' items (breads, rice, sides, beverages) are universal — shown to
    # every diet. veg => veg + mixed; non-veg => non-veg + mixed; mix => all.
    if diet == 'veg':
        return [i for i in items if i.get('item_type') in ('veg', 'mixed')]
    if diet == 'non-veg':
        return [i for i in items if i.get('item_type') in ('non-veg', 'mixed')]
    return list(items)


@chat_bp.route('/chat/discover', methods=['POST'])
@limiter.limit(LIMIT_AI)
def discover_items():
    """Smart discovery: diet (+ optional cuisine) + main category + subcategory
    + main ingredient + taste -> ALL matching items sorted by priority.

    Body: {restaurant_id, diet, cuisine?, main_category_id?, subcategory_id,
           ingredient, taste?}
      - diet: 'veg' | 'non-veg' | 'mix' (veg-only restaurant forces veg)
      - cuisine: cuisine name/key, 'others' (no label), or ''/omitted (no filter)
      - main_category_id: optional, additionally constrains the candidate set
      - subcategory_id: category id to filter on
      - ingredient: ingredient name/key or 'any'
      - taste: a single taste name; items whose `taste` list CONTAINS it
        (case-insensitive) are kept. ''/omitted/'any' disables the filter.
    """
    data = request.get_json() or {}
    restaurant_id = data.get('restaurant_id')
    diet = (data.get('diet') or '').strip().lower()
    cuisine = (data.get('cuisine') or '').strip()
    main_category_id = data.get('main_category_id', '')
    subcategory_id = data.get('subcategory_id', '')
    ingredient = (data.get('ingredient') or 'any').strip()
    taste = (data.get('taste') or '').strip().lower()

    if not restaurant_id or not subcategory_id:
        return jsonify({'error': 'Missing required fields'}), 400

    db_ref = get_db()
    res_data = db_ref.child(f'restaurants/{restaurant_id}').get()
    if not res_data:
        return jsonify({'error': 'Restaurant not found'}), 404

    restaurant_type = (res_data.get('restaurant_type') or 'mixed').strip().lower()
    if restaurant_type == 'veg':
        diet = 'veg'

    items = format_list(res_data.get('items'))
    active_items = [i for i in items if i.get('is_enabled') is not False]
    for it in active_items:
        it['taste'] = normalize_taste(it.get('taste'))

    cuisine_norm = cuisine.lower()
    # 'any' (the chat's "Any" option) and '' both mean no cuisine filter.
    if cuisine_norm == 'any':
        cuisine_norm = ''
    ingredient_norm = ingredient.lower()
    taste_filter = taste if taste and taste != 'any' else ''

    # --- Hard filters ---
    candidates = []
    for item in active_items:
        itype = item.get('item_type')
        if diet == 'veg' and itype not in ('veg', 'mixed'):
            continue
        if diet == 'non-veg' and itype not in ('non-veg', 'mixed'):
            continue
        if main_category_id and str(item.get('main_category_id', '')) != str(main_category_id):
            continue
        if str(item.get('category_id', '')) != str(subcategory_id):
            continue
        if ingredient_norm and ingredient_norm != 'any':
            if str(item.get('main_ingredient', '')).lower() != ingredient_norm:
                continue
        if cuisine_norm and cuisine_norm != 'others':
            if str(item.get('cuisine', '')).lower() != cuisine_norm:
                continue
        elif cuisine_norm == 'others':
            if item.get('cuisine'):
                continue
        if taste_filter:
            item_tastes = [t.lower() for t in normalize_taste(item.get('taste'))]
            if taste_filter not in item_tastes:
                continue
        candidates.append(item)

    # --- Sort by priority (high>medium>low), then bestseller. No cap. ---
    priority_map = {'high': 3, 'medium': 2, 'low': 1}
    candidates.sort(key=lambda x: (
        priority_map.get(x.get('priority', 'medium'), 2),
        1 if x.get('is_bestseller') else 0,
    ), reverse=True)

    if candidates:
        message = "Based on what you're craving, here are my picks for you!"
    else:
        message = "Hmm, I couldn't find an exact match. Try a different taste or ingredient?"

    return jsonify({'suggestions': candidates, 'message': message}), 200

@chat_bp.route('/chat/suggest', methods=['POST'])
@limiter.limit(LIMIT_AI)
def suggest_item():
    data = request.get_json()
    restaurant_id = data.get('restaurant_id')
    current_item = data.get('current_item', {})
    diet = data.get('diet', '')

    if not restaurant_id or not current_item:
        return jsonify({'error': 'Missing required fields'}), 400

    db_ref = get_db()
    res_data = db_ref.child(f'restaurants/{restaurant_id}').get()
    if not res_data:
        return jsonify({'error': 'Restaurant not found'}), 404

    items = format_list(res_data.get('items'))
    active_items = [i for i in items if i.get('is_enabled') is not False]
    for it in active_items:
        it['taste'] = normalize_taste(it.get('taste'))

    current_id = str(current_item.get('id', ''))

    # Check for admin-defined recommendations (flat map) on the current item.
    recs = normalize_recs(res_data.get('items', {}).get(current_id, {}).get('recommendations', {}))
    if recs:
        candidates = []
        for rec_id, rec_data in recs.items():
            match = next((i for i in active_items if str(i.get('id', '')) == rec_id), None)
            if match:
                priority_score = {'high': 3, 'medium': 2, 'low': 1}.get(rec_data.get('priority', 'medium'), 2)
                candidates.append({**match, 'score': priority_score})
        # Owner-curated "buy together" picks are shown as-is (no diet gate): a
        # non-veg guest may well pair a main with a veg side (raita, salad), and
        # the plan specifies all admin-defined recommendations display.
        candidates.sort(key=lambda x: x.get('score', 0), reverse=True)
        if candidates:
            return jsonify({
                'suggestions': candidates,
                'message': f"Others love to buy these together with <b>{current_item.get('name', 'that')}</b>!"
            }), 200

    # Fallback: match using item attributes — taste/heaviness similarity to the
    # picked dish within the same subcategory.
    current_cat_id = current_item.get('category_id')
    current_tastes = [t.lower() for t in normalize_taste(current_item.get('taste', ''))]
    current_heaviness = current_item.get('heaviness', '')

    suggestions = []
    for item in active_items:
        if str(item.get('id', '')) == current_id:
            continue
        if item.get('category_id') != current_cat_id:
            continue
        priority_score = {'high': 3, 'medium': 2, 'low': 1}.get(item.get('priority', 'medium'), 2)
        if item.get('is_bestseller'):
            priority_score += 1
        if current_tastes:
            item_tastes = [t.lower() for t in normalize_taste(item.get('taste', ''))]
            if set(item_tastes) & set(current_tastes):
                priority_score += 1
        if item.get('heaviness') == current_heaviness:
            priority_score += 1
        suggestions.append({**item, 'score': priority_score})

    suggestions = _filter_by_diet(suggestions, diet)
    suggestions.sort(key=lambda x: x.get('score', 0), reverse=True)

    if suggestions:
        return jsonify({
            'suggestions': suggestions,
            'message': f"Others love to buy these together with <b>{current_item.get('name', 'that')}</b>!"
        }), 200

    return jsonify({'suggestions': [], 'message': ''}), 200
