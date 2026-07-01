import sys
import os
import re

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from firebase_client import get_db

MENU_TEXT = """
TURKISH CUISINE
Turkish Nizami Chicken (Chef Signature Dish) — 899
Turkish Salt Baked Chicken (Full) — 899
Turkish Pide
Chicken / Veg / Cheese / Egg with Cheese — 269 / 230
Cheese / Egg with Cheese — 269 / 289
Istanbul Rahmani Chicken Kebab (Hotspot Signature Turkish Dish) — 480
Turkish Chicken Pizza — 300
Jinoori Alfaham Chicken — 200 / 390 / 750
Beef Yemegi (Turkish Beef Curry) — 400

KATI ROLLS
Beef Kheema Roll — 190
Mutton Sheekh Roll — 280
Chicken Sheekh Roll — 230
Pepper Chicken Roll — 170
Chilli Chicken Roll — 190
Chicken Tikka Roll — 170
Garlic Chicken Roll — 170
Chilli Paneer Roll — 190

SALADS
Caesar Salad — 250
Green Salad — 180
Arabic Salad — 180
Hummoos — 150

INDIAN CURRY (Balti)
Mutton Nihari — 830
Mutton Brain Pepper Fry — 450
Mutton Rogan Ghosh — 480
Mutton Pepper Fry — 480
Chicken Tikka Masala — 330
Butter Chicken — 330
Kadai Chicken — 330
Pepper Chicken Masala — 330
Dal Fry — 200
Dal Thadka — 200
Kadai Paneer — 330
Paneer Butter Masala — 330
Mixed Vegetable Kuruma — 200

KERALA SPECIALITY
Mutton Kurma — 490
Chicken Kurma — 380
Mutton Liver Varattiyathu — 480
Beef Roast — 300
Beef Fry — 300
Pothu Varattiyathu — 320
Beef Kizhi — 180 / 370
Chicken 65 — 350
Banglore Kabab — 250 / 450
Malabar Chicken Curry — 280
Ghee Rice — 160

STARTERS
Lahori Chicken (Half / Full) — 250 / 450
Dragon Wings — 380
Banglore Kabab (Half / Full) — 250 / 450
Beef Tikka (Half / Full) — 200 / 400
Grilled Chicken Wings (Half / Full) — 250 / 450
Paneer Tikka — 450
Chicken Lolipop — 420
Mushroom Pepper Garlic — 370
Honey Glazed Chicken — 370
French Fries — 180
Stir Fry Chicken with Chinese Vegetable — 370
Crispy Chilly Potato — 250
Chicken 65 — 350
Lamb Chops — 850
Beef with Broccoli & Mushroom — 380
Dragon Chicken — 370
Roast Beef Chilly Sauce — 400
Thai Lemon Basil Fish — 450
Singapore Chilly Whole Fish — 650
Thai Basil Chilly Fish — 450

SOUP
Tom Yum Soup (Sea Food / Chicken) — 230 / 200
Tom Kha Soup (Sea Food / Chicken) — 230 / 200
Arabic Lamb Soup — 230
Lung Fung Soup (Seafood / Chicken) — 250
Manchow Soup — 130 / 180
Creamy Mushroom Soup with Chicken — 190
Sweet Corn Soup — 130 / 170
Hots & Sour Soup — 130 / 170

NOODLES
Butter Garlic Noodles (Veg / Non Veg) — 200 / 220
Hotspot Special Noodles (Chicken / Prawns) — 230 / 240
Thai Roasted Noodles (Chicken / Prawns) — 240 / 260
Schezwan Noodles (Veg / Non Veg) — 200 / 230
American Chopsuey (Veg / Non Veg) — 280 / 350
Chinese Chopsuey (Veg / Non Veg) — 280 / 350

STRAIGHT FROM THE WOK
Honey Glazed Chicken — 370
Hunan Chicken — 370
Stir Fry Chicken with Chinese Vegetable — 370
Dragon Wings — 380
Thai Green Curry (Chicken / Seafood) with Steam Rice — 350 / 400
Prawns Pepper Onion — 450
Smoked Chilli Beef — 350
Mushroom Pepper Garlic — 350
Dragon Chicken — 370
Beef with Broccoli & Mushroom — 380
Thai Red Curry Beef — 400
Roast Beef Chilly Sauce — 400
Stir Fry Prawns with Chinese Vegetable — 450
Chilli Chicken with Red Yellow Bell Pepper — 320
Thai Nam Prik Sauce (Chicken / Prawns) — 300 / 400
Kungpau Chicken — 330
Cauli Flower Choice of Sauce (Manchurian / Chilly) — 230
Paneer Choice of Sauce (Manchurian / Chilly) — 340
Chicken in Hot Garlic Sauce — 330
"""

ITEM_IMAGES = {
    # Turkish
    'Turkish Nizami Chicken': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=300&q=80',
    'Turkish Salt Baked Chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=300&q=80',
    'Turkish Pide': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=300&q=80',
    'Istanbul Rahmani Chicken Kebab': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=300&q=80',
    'Turkish Chicken Pizza': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=300&q=80',
    'Jinoori Alfaham Chicken': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=300&q=80',
    'Beef Yemegi': 'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=300&q=80',
    # Rolls
    'Beef Kheema Roll': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=300&q=80',
    'Mutton Sheekh Roll': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=300&q=80',
    'Chicken Sheekh Roll': 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=300&q=80',
    'Pepper Chicken Roll': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=300&q=80',
    'Chilli Chicken Roll': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=300&q=80',
    'Chicken Tikka Roll': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=300&q=80',
    'Garlic Chicken Roll': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=300&q=80',
    'Chilli Paneer Roll': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=300&q=80',
    # Salads
    'Caesar Salad': 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=300&q=80',
    'Green Salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=300&q=80',
    'Arabic Salad': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=300&q=80',
    'Hummoos': 'https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=300&q=80',
    # Indian Curry
    'Mutton Nihari': 'https://images.unsplash.com/photo-1545247181-516773cae754?auto=format&fit=crop&w=300&q=80',
    'Mutton Brain Pepper Fry': 'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=300&q=80',
    'Mutton Rogan Ghosh': 'https://images.unsplash.com/photo-1545247181-516773cae754?auto=format&fit=crop&w=300&q=80',
    'Mutton Pepper Fry': 'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=300&q=80',
    'Chicken Tikka Masala': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=300&q=80',
    'Butter Chicken': 'https://images.unsplash.com/photo-1603894584373-5ac82b6ae398?auto=format&fit=crop&w=300&q=80',
    'Kadai Chicken': 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=300&q=80',
    'Pepper Chicken Masala': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=300&q=80',
    'Dal Fry': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80',
    'Dal Thadka': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80',
    'Kadai Paneer': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=300&q=80',
    'Paneer Butter Masala': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=300&q=80',
    'Mixed Vegetable Kuruma': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=300&q=80',
    # Kerala
    'Mutton Kurma': 'https://images.unsplash.com/photo-1545247181-516773cae754?auto=format&fit=crop&w=300&q=80',
    'Chicken Kurma': 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=300&q=80',
    'Mutton Liver Varattiyathu': 'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=300&q=80',
    'Beef Roast': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=80',
    'Beef Fry': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=80',
    'Pothu Varattiyathu': 'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=300&q=80',
    'Beef Kizhi': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=80',
    'Chicken 65': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=300&q=80',
    'Banglore Kabab': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=300&q=80',
    'Malabar Chicken Curry': 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=300&q=80',
    'Ghee Rice': 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?auto=format&fit=crop&w=300&q=80',
    # Starters
    'Lahori Chicken': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=300&q=80',
    'Dragon Wings': 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=300&q=80',
    'Beef Tikka': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=80',
    'Grilled Chicken Wings': 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=300&q=80',
    'Paneer Tikka': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=300&q=80',
    'Chicken Lolipop': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=300&q=80',
    'Mushroom Pepper Garlic': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=300&q=80',
    'Honey Glazed Chicken': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=300&q=80',
    'French Fries': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=300&q=80',
    'Stir Fry Chicken': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=300&q=80',
    'Crispy Chilly Potato': 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=300&q=80',
    'Lamb Chops': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=80',
    'Beef with Broccoli': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=300&q=80',
    'Dragon Chicken': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=300&q=80',
    'Roast Beef Chilly Sauce': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=80',
    'Thai Lemon Basil Fish': 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?auto=format&fit=crop&w=300&q=80',
    'Singapore Chilly Whole Fish': 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?auto=format&fit=crop&w=300&q=80',
    'Thai Basil Chilly Fish': 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?auto=format&fit=crop&w=300&q=80',
    # Soups
    'Tom Yum Soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=300&q=80',
    'Tom Kha Soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=300&q=80',
    'Arabic Lamb Soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=300&q=80',
    'Lung Fung Soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=300&q=80',
    'Manchow Soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=300&q=80',
    'Creamy Mushroom Soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=300&q=80',
    'Sweet Corn Soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=300&q=80',
    'Hots & Sour Soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=300&q=80',
    # Noodles
    'Butter Garlic Noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&q=80',
    'Hotspot Special Noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&q=80',
    'Thai Roasted Noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&q=80',
    'Schezwan Noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&q=80',
    'American Chopsuey': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&q=80',
    'Chinese Chopsuey': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&q=80',
    # Wok
    'Hunan Chicken': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=300&q=80',
    'Thai Green Curry': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=300&q=80',
    'Prawns Pepper Onion': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=300&q=80',
    'Smoked Chilli Beef': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=80',
    'Thai Red Curry Beef': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=300&q=80',
    'Stir Fry Prawns': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=300&q=80',
    'Chilli Chicken with Red Yellow Bell Pepper': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=300&q=80',
    'Thai Nam Prik Sauce': 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=300&q=80',
    'Kungpau Chicken': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=300&q=80',
    'Cauli Flower Choice of Sauce': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=300&q=80',
    'Paneer Choice of Sauce': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=300&q=80',
    'Chicken in Hot Garlic Sauce': 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=300&q=80',
    # Fallback images by category
    'Turkish': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=300&q=80',
    'Rolls': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=300&q=80',
    'Salads': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=300&q=80',
    'Indian': 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=300&q=80',
    'Kerala': 'https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?auto=format&fit=crop&w=300&q=80',
    'Starters': 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=300&q=80',
    'Soups': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=300&q=80',
    'Noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&q=80',
    'Wok': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&q=80',
}

def parse_menu(text):
    sections = []
    current_section = None
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    for line in lines:
        if ' — ' not in line and '/' not in line and line.isupper():
            current_section = {'name': line, 'items': []}
            sections.append(current_section)
        elif current_section:
            if ' — ' in line:
                name, price_str = line.split(' — ', 1)
                prices = re.findall(r'\d+', price_str)
                price = int(prices[0]) if prices else 0
                description = f"Options: {price_str}" if len(prices) > 1 else ""
                current_section['items'].append({
                    'name': name.strip(),
                    'price': price,
                    'description': description
                })
    return sections

def get_item_type(name):
    non_veg_keywords = ['chicken', 'beef', 'mutton', 'lamb', 'fish', 'prawn', 'egg', 'wings', 'kebab', 'tikka', 'kheema', 'meat', 'liver', 'pothu', 'kabab']
    name_lower = name.lower()
    if 'paneer' in name_lower: return 'veg'
    for kw in non_veg_keywords:
        if kw in name_lower: return 'non-veg'
    return 'veg'

def get_item_image(name, main_name):
    name_lower = name.lower()
    for key, url in ITEM_IMAGES.items():
        if key.lower() in name_lower:
            return url
    return ITEM_IMAGES.get(main_name, '')

def seed_new_menu():
    db_ref = get_db()
    restaurants = db_ref.child('restaurants').get()
    if not restaurants: return
    res_id = list(restaurants.keys())[0]
    db_ref.child(f'restaurants/{res_id}/main_categories').delete()
    db_ref.child(f'restaurants/{res_id}/categories').delete()
    db_ref.child(f'restaurants/{res_id}/items').delete()

    sections = parse_menu(MENU_TEXT)
    mapping = {
        'TURKISH CUISINE': {'main': 'Turkish', 'cat': 'Turkish Specialties', 'type': 'main'},
        'KATI ROLLS': {'main': 'Rolls', 'cat': 'Kati Rolls', 'type': 'starter'},
        'SALADS': {'main': 'Salads', 'cat': 'Fresh Salads', 'type': 'starter'},
        'INDIAN CURRY (Balti)': {'main': 'Indian', 'cat': 'Indian Curries', 'type': 'main'},
        'KERALA SPECIALITY': {'main': 'Kerala', 'cat': 'Kerala Specialties', 'type': 'main'},
        'STARTERS': {'main': 'Starters', 'cat': 'Appetizers', 'type': 'starter'},
        'SOUP': {'main': 'Soups', 'cat': 'Soups', 'type': 'starter'},
        'NOODLES': {'main': 'Noodles', 'cat': 'Noodles', 'type': 'main'},
        'STRAIGHT FROM THE WOK': {'main': 'Wok', 'cat': 'Wok Specials', 'type': 'main'}
    }

    main_cats_cache = {}
    cats_cache = {}
    main_cats_ref = db_ref.child(f'restaurants/{res_id}/main_categories')
    cats_ref = db_ref.child(f'restaurants/{res_id}/categories')
    items_ref = db_ref.child(f'restaurants/{res_id}/items')

    for section in sections:
        section_name = section['name']
        map_info = mapping.get(section_name)
        if not map_info: continue
        main_name = map_info['main']
        if main_name not in main_cats_cache:
            mc = main_cats_ref.push({'name': main_name, 'display_order': len(main_cats_cache) + 1})
            main_cats_cache[main_name] = mc.key
        mc_id = main_cats_cache[main_name]
        cat_name = map_info['cat']
        course_type = map_info['type']
        cat_key = f"{mc_id}_{cat_name}"
        if cat_key not in cats_cache:
            c = cats_ref.push({'name': cat_name, 'display_order': len(cats_cache) + 1, 'main_category_id': mc_id, 'course_type': course_type})
            cats_cache[cat_key] = c.key
        cat_id = cats_cache[cat_key]

        for item in section['items']:
            item_cat_id = cat_id
            item_course_type = course_type
            if 'Ghee Rice' in item['name']:
                rice_cat_key = f"{mc_id}_Rice"
                if rice_cat_key not in cats_cache:
                    rc = cats_ref.push({'name': 'Rice', 'display_order': 100, 'main_category_id': mc_id, 'course_type': 'rice'})
                    cats_cache[rice_cat_key] = rc.key
                item_cat_id = cats_cache[rice_cat_key]
                item_course_type = 'rice'

            is_signature = '(Chef Signature Dish)' in item['name'] or 'Signature' in item['name'] or '(Hotspot Signature' in item['name']

            print(f"Adding item: {item['name']} with image: {get_item_image(item['name'], main_name)}")
            items_ref.push({
                'name': item['name'],
                'description': item['description'] or f"Delicious {item['name']} from our {section_name.lower()} selection.",
                'price': item['price'],
                'image_url': get_item_image(item['name'], main_name),
                'main_category_id': mc_id,
                'category_id': item_cat_id,
                'course_type': item_course_type,
                'item_type': get_item_type(item['name']),
                'spice_level': 3,
                'heaviness': 'medium',
                'is_enabled': True,
                'priority': 'high' if is_signature else 'medium',
                'is_bestseller': is_signature
            })
    print("SUCCESS: Menu updated with priority and course_type!")

if __name__ == '__main__':
    seed_new_menu()
