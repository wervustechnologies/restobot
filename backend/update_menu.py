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
                # Handle cases like "200 / 390 / 750" or "As per size"
                if 'As per size' in price_str:
                    price = 0 # Placeholder for "As per size"
                    description = "Price as per size"
                else:
                    prices = re.findall(r'\d+', price_str)
                    price = int(prices[0]) if prices else 0
                    description = f"Options: {price_str}" if len(prices) > 1 else ""
                
                current_section['items'].append({
                    'name': name.strip(),
                    'price': price,
                    'description': description
                })
            elif '/' in line and not any(c.isdigit() for c in line.split('/')[0]):
                # This handles sub-categories or multi-options without prices yet
                # e.g. Chicken / Veg / Cheese / Egg with Cheese — 269 / 230
                # Actually, the previous regex might handle it if it follows the — format.
                pass
    
    return sections

def get_item_type(name):
    non_veg_keywords = ['chicken', 'beef', 'mutton', 'lamb', 'fish', 'prawn', 'egg', 'wings', 'kebab', 'tikka', 'kheema', 'meat', 'liver', 'pothu', 'kabab']
    veg_keywords = ['veg', 'paneer', 'cheese', 'dal', 'mushroom', 'potato', 'french fries', 'ghee', 'corn', 'cauli flower', 'hummoos', 'salad']
    
    name_lower = name.lower()
    
    # If it says "Paneer Tikka" it should be veg
    if 'paneer' in name_lower:
        return 'veg'
    
    for kw in non_veg_keywords:
        if kw in name_lower:
            return 'non-veg'
    
    return 'veg'

def get_spice_level(name):
    spicy_keywords = ['chilli', 'schezwan', 'pepper', 'hot', 'spicy', 'kungpau', 'manchow', 'dragon', 'roast']
    name_lower = name.lower()
    for kw in spicy_keywords:
        if kw in name_lower:
            return 4
    return 2

def seed_new_menu():
    db_ref = get_db()
    restaurants = db_ref.child('restaurants').get()
    if not restaurants:
        print("No restaurants found.")
        return
    res_id = list(restaurants.keys())[0]
    print(f"Updating menu for restaurant ID: {res_id}")

    # Clear existing
    db_ref.child(f'restaurants/{res_id}/main_categories').delete()
    db_ref.child(f'restaurants/{res_id}/categories').delete()
    db_ref.child(f'restaurants/{res_id}/items').delete()

    sections = parse_menu(MENU_TEXT)
    
    # Hierarchy Mapping
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

    for i, section in enumerate(sections):
        section_name = section['name']
        map_info = mapping.get(section_name)
        
        if not map_info:
            print(f"Skipping unknown section: {section_name}")
            continue
            
        main_name = map_info['main']
        if main_name not in main_cats_cache:
            mc = main_cats_ref.push({'name': main_name, 'display_order': len(main_cats_cache) + 1})
            main_cats_cache[main_name] = mc.key
            
        mc_id = main_cats_cache[main_name]
        
        cat_name = map_info['cat']
        course_type = map_info['type']
        
        cat_key = f"{mc_id}_{cat_name}"
        if cat_key not in cats_cache:
            c = cats_ref.push({
                'name': cat_name, 
                'display_order': len(cats_cache) + 1, 
                'main_category_id': mc_id,
                'course_type': course_type
            })
            cats_cache[cat_key] = c.key
            
        cat_id = cats_cache[cat_key]
        
        for item in section['items']:
            # Special case for Ghee Rice in Kerala Speciality
            item_course_type = course_type
            item_cat_id = cat_id
            
            if 'Ghee Rice' in item['name']:
                # Create a Rice category if not exists
                rice_cat_key = f"{mc_id}_Rice"
                if rice_cat_key not in cats_cache:
                    rc = cats_ref.push({
                        'name': 'Rice',
                        'display_order': 100,
                        'main_category_id': mc_id,
                        'course_type': 'rice'
                    })
                    cats_cache[rice_cat_key] = rc.key
                item_cat_id = cats_cache[rice_cat_key]

            items_ref.push({
                'name': item['name'],
                'description': item['description'] or f"Delicious {item['name']} from our {section_name.lower()} selection.",
                'price': item['price'],
                'main_category_id': mc_id,
                'category_id': item_cat_id,
                'item_type': get_item_type(item['name']),
                'spice_level': get_spice_level(item['name']),
                'heaviness': 'medium',
                'is_enabled': True,
                'is_bestseller': '(Chef Signature Dish)' in item['name'] or '(Hotspot Signature Turkish Dish)' in item['name']
            })

    print("SUCCESS: Menu updated successfully!")

if __name__ == '__main__':
    seed_new_menu()
