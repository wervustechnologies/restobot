"""Demo seed for the new Category -> Subcategory -> Item menu model.

Run with:  python backend/seed_demo.py

It picks the first restaurant, sets its restaurant_type, seeds optional
cuisine labels + a main-ingredient list, then builds a broad-Category menu
(Food / Beverages) with Subcategories and items tagged with main_ingredient,
cuisine and an expanded taste profile, plus recommendations used by the chat
chain step.
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from firebase_client import get_db
from default_ingredients import build_default_ingredients

IMG_CURRY = "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80"
IMG_BIRYANI = "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80"
IMG_NAAN = "https://images.unsplash.com/photo-1626200419188-f1a16b4a37a6?w=400&q=80"
IMG_STARTER = "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80"
IMG_COFFEE = "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80"
IMG_TEA = "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80"
IMG_FISH = "https://images.unsplash.com/photo-1534604973900-c43ab0c2a5b0?w=400&q=80"


def seed_demo():
    db_ref = get_db()
    restaurants = db_ref.child('restaurants').get()
    if not restaurants:
        print("No restaurants found. Create one via the superadmin dashboard first.")
        return
    res_id = list(restaurants.keys())[0]
    print(f"Seeding demo menu for restaurant ID: {res_id}")

    base = f'restaurants/{res_id}'

    # --- Restaurant type + controlled vocabularies ---
    db_ref.child(base).update({'restaurant_type': 'mixed'})

    db_ref.child(f'{base}/cuisines').delete()
    cuisines_ref = db_ref.child(f'{base}/cuisines')
    c_indian = cuisines_ref.push({'name': 'Indian', 'display_order': 1}).key
    c_kerala = cuisines_ref.push({'name': 'Kerala', 'display_order': 2}).key
    cuisines = {'Indian': c_indian, 'Kerala': c_kerala}

    db_ref.child(f'{base}/ingredients').delete()
    ing_ref = db_ref.child(f'{base}/ingredients')
    ing_map = {}
    for entry in build_default_ingredients('mixed'):
        ing_map[entry['name']] = ing_ref.push(entry).key

    # --- Clear + rebuild menu (Category -> Subcategory -> Items) ---
    for node in ('main_categories', 'categories', 'items'):
        db_ref.child(f'{base}/{node}').delete()

    mc_ref = db_ref.child(f'{base}/main_categories')
    food = mc_ref.push({'name': 'Food', 'display_order': 1}).key
    bevs = mc_ref.push({'name': 'Beverages', 'display_order': 2}).key

    cat_ref = db_ref.child(f'{base}/categories')
    curries = cat_ref.push({'name': 'Curries', 'main_category_id': food, 'course_type': 'main', 'display_order': 1}).key
    biryani = cat_ref.push({'name': 'Biryani & Rice', 'main_category_id': food, 'course_type': 'rice', 'display_order': 2}).key
    breads = cat_ref.push({'name': 'Breads', 'main_category_id': food, 'course_type': 'bread', 'display_order': 3}).key
    starters = cat_ref.push({'name': 'Starters', 'main_category_id': food, 'course_type': 'starter', 'display_order': 4}).key
    coffee_cat = cat_ref.push({'name': 'Coffee', 'main_category_id': bevs, 'course_type': 'beverage', 'display_order': 5}).key
    tea_cat = cat_ref.push({'name': 'Tea', 'main_category_id': bevs, 'course_type': 'beverage', 'display_order': 6}).key

    items_ref = db_ref.child(f'{base}/items')

    def add(name, desc, price, cat_id, item_type, ingredient, cuisine_name,
            taste, spice, heaviness, priority, img, bestseller=False):
        return items_ref.push({
            'name': name, 'description': desc, 'price': price,
            'main_category_id': food if cat_id in (curries, biryani, breads, starters) else bevs,
            'category_id': cat_id,
            'item_type': item_type,
            'main_ingredient': ingredient,
            'cuisine': cuisines.get(cuisine_name, ''),
            'taste': taste, 'spice_level': spice, 'heaviness': heaviness,
            'priority': priority, 'is_enabled': True, 'is_bestseller': bestseller,
            'image_url': img,
        }).key

    I = {}

    # --- Curries ---
    I['butter_chicken'] = add('Butter Chicken', 'Creamy tomato chicken curry', 280, curries,
                              'non-veg', 'Chicken', 'Indian', 'creamy', 2, 'heavy', 'high', IMG_CURRY, True)
    I['chicken_curry'] = add('Kerala Chicken Curry', 'Coconut chicken curry with curry leaves', 260, curries,
                             'non-veg', 'Chicken', 'Kerala', 'spicy', 4, 'heavy', 'high', IMG_CURRY, True)
    I['fish_curry'] = add('Meen Curry', 'Tangy fish in tamarind-coconut gravy', 250, curries,
                          'non-veg', 'Fish', 'Kerala', 'sour', 4, 'medium', 'medium', IMG_FISH)
    I['paneer_masala'] = add('Paneer Butter Masala', 'Mild cottage cheese curry', 220, curries,
                             'veg', 'Paneer', 'Indian', 'creamy', 2, 'medium', 'high', IMG_CURRY, True)
    I['kadala'] = add('Kadala Curry', 'Black chickpea coconut curry', 140, curries,
                      'veg', 'Lentils/Dal', 'Kerala', 'spicy', 3, 'medium', 'medium', IMG_CURRY)
    I['mushroom'] = add('Mushroom Pepper Fry', 'Spicy mushroom stir-fry', 160, curries,
                        'veg', 'Mushroom', 'Kerala', 'savoury', 3, 'light', 'low', IMG_CURRY)

    # --- Biryani & Rice ---
    I['chicken_biryani'] = add('Chicken Biryani', 'Aromatic basmati rice with chicken', 290, biryani,
                               'non-veg', 'Chicken', 'Indian', 'spicy', 3, 'heavy', 'high', IMG_BIRYANI, True)
    I['veg_biryani'] = add('Veg Biryani', 'Fragrant rice with mixed vegetables', 220, biryani,
                           'veg', 'Vegetables', 'Indian', 'spicy', 3, 'heavy', 'medium', IMG_BIRYANI)
    I['ghee_rice'] = add('Ghee Rice', 'Basmati tempered with ghee and spices', 140, biryani,
                         'veg', 'Vegetables', 'Kerala', 'savoury', 1, 'medium', 'medium', IMG_BIRYANI)

    # --- Breads ---
    I['butter_naan'] = add('Butter Naan', 'Soft tandoor bread brushed with butter', 45, breads,
                           'mixed', 'Vegetables', 'Indian', 'savoury', 1, 'light', 'high', IMG_NAAN, True)
    I['parotta'] = add('Kerala Parotta', 'Flaky layered flatbread', 40, breads,
                       'mixed', 'Vegetables', 'Kerala', 'savoury', 1, 'medium', 'high', IMG_NAAN)

    # --- Starters ---
    I['chicken_tikka'] = add('Chicken Tikka', 'Spiced grilled chicken skewers', 260, starters,
                             'non-veg', 'Chicken', 'Indian', 'tangy', 3, 'light', 'high', IMG_STARTER, True)
    I['paneer_tikka'] = add('Paneer Tikka', 'Grilled cottage cheese skewers', 220, starters,
                            'veg', 'Paneer', 'Indian', 'tangy', 2, 'light', 'medium', IMG_STARTER)

    # --- Beverages ---
    I['filter_coffee'] = add('Filter Coffee', 'South Indian frothy filter coffee', 35, coffee_cat,
                             'veg', 'Vegetables', 'Kerala', 'creamy', 1, 'light', 'high', IMG_COFFEE, True)
    I['cappuccino'] = add('Cappuccino', 'Espresso with steamed milk', 60, coffee_cat,
                          'veg', 'Vegetables', 'Indian', 'creamy', 1, 'light', 'medium', IMG_COFFEE)
    I['black_tea'] = add('Black Tea', 'Strong ginger tea', 20, tea_cat,
                         'veg', 'Vegetables', 'Kerala', 'sweet', 1, 'light', 'high', IMG_TEA)
    I['masala_tea'] = add('Masala Chai', 'Cardamom spiced milk tea', 25, tea_cat,
                          'veg', 'Vegetables', 'Indian', 'sweet', 1, 'light', 'high', IMG_TEA)

    # --- Recommendations (chat chain: food_items + beverages) ---
    def set_recs(item_key, food_items=None, beverages=None):
        data = {}
        if food_items:
            data['food_items'] = {fid: {'priority': p} for fid, p in food_items.items()}
        if beverages:
            data['beverages'] = {bid: {'priority': p} for bid, p in beverages.items()}
        if data:
            items_ref.child(f'{item_key}/recommendations').set(data)

    set_recs(I['butter_chicken'], {I['butter_naan']: 'high', I['ghee_rice']: 'medium'},
             {I['masala_tea']: 'high'})
    set_recs(I['chicken_curry'], {I['parotta']: 'high', I['ghee_rice']: 'medium'},
             {I['black_tea']: 'high'})
    set_recs(I['chicken_biryani'], {I['butter_naan']: 'medium'},
             {I['filter_coffee']: 'high', I['masala_tea']: 'medium'})
    set_recs(I['paneer_masala'], {I['butter_naan']: 'high', I['ghee_rice']: 'medium'},
             {I['masala_tea']: 'high'})
    set_recs(I['fish_curry'], {I['parotta']: 'high', I['ghee_rice']: 'high'},
             {I['black_tea']: 'high'})
    set_recs(I['chicken_tikka'], {I['butter_naan']: 'medium'},
             {I['filter_coffee']: 'high'})
    set_recs(I['veg_biryani'], {I['paneer_tikka']: 'medium'},
             {I['masala_tea']: 'high'})

    print("Demo menu seeded: Category -> Subcategory -> Items with ingredient/cuisine/taste + recommendations.")


if __name__ == '__main__':
    seed_demo()
