from flask import Blueprint, request, jsonify
from firebase_client import get_db
from limiter import limiter, LIMIT_AI
from rec_utils import normalize_recs

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

def _spice_cap(spice):
    # Chat spice selection -> max item spice_level (1-5) to include.
    # mild => gentle only (<=2); medium => up to medium-hot (<=4); spicy/unspecified => all.
    if spice == 'mild':
        return 2
    if spice == 'medium':
        return 4
    return 5


@chat_bp.route('/chat/discover', methods=['POST'])
@limiter.limit(LIMIT_AI)
def discover_items():
    """Smart discovery: diet (+ optional cuisine) + subcategory + main
    ingredient + taste -> top 3 scored items.

    Body: {restaurant_id, diet, cuisine?, subcategory_id, ingredient, taste}
      - diet: 'veg' | 'non-veg' | 'mix' (veg-only restaurant forces veg)
      - cuisine: cuisine name/key, 'others' (no label), or ''/omitted (no filter)
      - subcategory_id: category id to filter on
      - ingredient: ingredient name/key or 'any'
      - taste: spicy/sweet/savoury/tangy/sour/salty/creamy
    """
    data = request.get_json() or {}
    restaurant_id = data.get('restaurant_id')
    diet = (data.get('diet') or '').strip().lower()
    cuisine = (data.get('cuisine') or '').strip()
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

    cuisine_norm = cuisine.lower()
    ingredient_norm = ingredient.lower()

    # --- Hard filters ---
    candidates = []
    for item in active_items:
        itype = item.get('item_type')
        if diet == 'veg' and itype not in ('veg', 'mixed'):
            continue
        if diet == 'non-veg' and itype not in ('non-veg', 'mixed'):
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
        candidates.append(item)

    # --- Score ---
    priority_map = {'high': 3, 'medium': 2, 'low': 1}
    scored = []
    for item in candidates:
        score = priority_map.get(item.get('priority', 'medium'), 2)
        if item.get('is_bestseller'):
            score += 1
        if taste and str(item.get('taste', '')).lower() == taste:
            score += 3
        spice_level = int(item.get('spice_level') or 3)
        if taste == 'spicy' and spice_level >= 3:
            score += 1
        scored.append({**item, 'match_score': score})

    # tie-break: higher score first; spicy taste prefers hotter items, others milder
    if taste == 'spicy':
        scored.sort(key=lambda x: (x['match_score'], int(x.get('spice_level') or 3)), reverse=True)
    else:
        scored.sort(key=lambda x: (x['match_score'], -int(x.get('spice_level') or 3)), reverse=True)

    top = scored[:3]

    if top:
        message = f"Based on what you're craving, here are my top <b>{len(top)}</b> picks for you!"
    else:
        message = "Hmm, I couldn't find an exact match. Try a different taste or ingredient?"

    return jsonify({'suggestions': top, 'message': message}), 200

@chat_bp.route('/chat/suggest', methods=['POST'])
@limiter.limit(LIMIT_AI)
def suggest_item():
    data = request.get_json()
    restaurant_id = data.get('restaurant_id')
    current_item = data.get('current_item', {})
    diet = data.get('diet', '')
    spice = data.get('spice', '')

    if not restaurant_id or not current_item:
        return jsonify({'error': 'Missing required fields'}), 400

    db_ref = get_db()
    res_data = db_ref.child(f'restaurants/{restaurant_id}').get()
    if not res_data:
        return jsonify({'error': 'Restaurant not found'}), 404

    items = format_list(res_data.get('items'))
    active_items = [i for i in items if i.get('is_enabled') is not False]

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
        candidates = _filter_by_diet(candidates, diet)
        cap = _spice_cap(spice)
        within = [c for c in candidates if int(c.get('spice_level') or 3) <= cap]
        if within:
            candidates = within
        candidates.sort(key=lambda x: x.get('score', 0), reverse=True)
        if candidates:
            return jsonify({
                'suggestions': candidates,
                'message': f"Others love to buy these together with <b>{current_item.get('name', 'that')}</b>!"
            }), 200

    # Fallback: match using item attributes — the guest's spice band, plus
    # taste/heaviness similarity to the picked dish.
    current_cat_id = current_item.get('category_id')
    current_taste = current_item.get('taste', '')
    current_heaviness = current_item.get('heaviness', '')
    cap = _spice_cap(spice)

    suggestions = []
    for item in active_items:
        if str(item.get('id', '')) == current_id:
            continue
        if item.get('category_id') != current_cat_id:
            continue
        priority_score = {'high': 3, 'medium': 2, 'low': 1}.get(item.get('priority', 'medium'), 2)
        if item.get('is_bestseller'):
            priority_score += 1
        if item.get('taste') == current_taste:
            priority_score += 1
        if item.get('heaviness') == current_heaviness:
            priority_score += 1
        suggestions.append({**item, 'score': priority_score})

    suggestions = _filter_by_diet(suggestions, diet)
    within = [s for s in suggestions if int(s.get('spice_level') or 3) <= cap]
    if within:
        suggestions = within
    suggestions.sort(key=lambda x: x.get('score', 0), reverse=True)

    if suggestions:
        return jsonify({
            'suggestions': suggestions,
            'message': f"Others love to buy these together with <b>{current_item.get('name', 'that')}</b>!"
        }), 200

    return jsonify({'suggestions': [], 'message': ''}), 200
