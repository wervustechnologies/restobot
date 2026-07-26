import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from firebase_client import get_db

def seed_kerala():
    db_ref = get_db()
    restaurants = db_ref.child('restaurants').get()
    if not restaurants:
        print("No restaurants found.")
        return
    res_id = list(restaurants.keys())[0]
    print(f"Seeding Kerala cuisine for restaurant ID: {res_id}")

    IMG = 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=400&q=80'
    IMG_APPAM = 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=80'
    IMG_DOSA = 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&q=80'
    IMG_PARATHA = 'https://images.unsplash.com/photo-1626200419188-f1a16b4a37a6?w=400&q=80'
    IMG_THALI = 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=400&q=80'
    IMG_CURRY = 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=80'
    IMG_FISH = 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=400&q=80'
    IMG_TEA = 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80'
    IMG_COFFEE = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80'
    IMG_JUICE = 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&q=80'
    IMG_SNACK = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80'
    IMG_BANANA = 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b502?w=400&q=80'
    IMG_PAYASAM = 'https://images.unsplash.com/photo-1593701460337-1284de3dfbb2?w=400&q=80'
    IMG_BREAD = 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=400&q=80'

    mc_ref = db_ref.child(f'restaurants/{res_id}/main_categories').push({'name': 'Kerala', 'display_order': 3})
    mc_id = mc_ref.key
    print(f"Created Main Category 'Kerala' (ID: {mc_id})")

    cats_ref = db_ref.child(f'restaurants/{res_id}/categories')
    breakfast_cat = cats_ref.push({'name': 'Traditional Breakfast', 'display_order': 1, 'main_category_id': mc_id, 'course_type': 'starter'})
    main_cat = cats_ref.push({'name': 'Main Course', 'display_order': 2, 'main_category_id': mc_id, 'course_type': 'main'})
    sides_cat = cats_ref.push({'name': 'Side Dishes & Curries', 'display_order': 3, 'main_category_id': mc_id, 'course_type': 'main'})
    bev_cat = cats_ref.push({'name': 'Beverages', 'display_order': 4, 'main_category_id': mc_id, 'course_type': 'beverage'})

    items_ref = db_ref.child(f'restaurants/{res_id}/items')

    def add(name, desc, price, cat_id, item_type, taste, spice, heaviness, priority, img, bestseller=False):
        ref = items_ref.push({
            'name': name, 'description': desc, 'price': price,
            'main_category_id': mc_id, 'category_id': cat_id,
            'item_type': item_type, 'taste': taste, 'spice_level': spice,
            'heaviness': heaviness, 'priority': priority,
            'is_enabled': True, 'is_bestseller': bestseller, 'image_url': img
        })
        return ref.key

    I = {}  # item ID map

    # ---- Breakfast Items ----
    I['puttu'] = add('Puttu', 'Steamed rice cake made of ground rice, layered with coconut shavings', 50, breakfast_cat.key, 'veg', 'salty', 1, 'light', 'high', IMG, True)
    I['appam'] = add('Appam', 'Soft, lacy fermented rice pancake with a thick spongy centre and crispy edges', 40, breakfast_cat.key, 'veg', 'creamy', 1, 'light', 'high', IMG_APPAM, True)
    I['idiyappam'] = add('Idiyappam (Nool Puttu)', 'Steamed rice noodles pressed into coil shapes, light and fluffy', 45, breakfast_cat.key, 'veg', 'salty', 1, 'light', 'medium', IMG_BREAD)
    I['dosa'] = add('Dosa', 'Crispy, golden fermented rice and urad dal crepe', 50, breakfast_cat.key, 'veg', 'salty', 1, 'light', 'high', IMG_DOSA, True)
    I['pathiri'] = add('Pathiri', 'Soft, thin rice flatbread typical of Malabar cuisine', 35, breakfast_cat.key, 'veg', 'salty', 1, 'light', 'medium', IMG_BREAD)
    I['kanji'] = add('Kanji (Rice Porridge)', 'Slow-cooked rice porridge, silky and comforting, a traditional breakfast staple', 40, breakfast_cat.key, 'veg', 'creamy', 1, 'light', 'medium', IMG)

    # ---- Main Course Items ----
    I['parotta'] = add('Kerala Parotta', 'Flaky, layered whole wheat flatbread with a crisp exterior and soft inside', 40, main_cat.key, 'veg', 'salty', 1, 'medium', 'high', IMG_PARATHA, True)
    I['kappa'] = add('Kappa (Tapioca)', 'Boiled and mashed tapioca with turmeric and green chillies, a Kerala staple', 80, main_cat.key, 'veg', 'salty', 1, 'medium', 'high', IMG)
    I['neychoru'] = add('Neychoru (Ghee Rice)', 'Fragrant basmati rice tempered with ghee, cashews, and whole spices', 120, main_cat.key, 'veg', 'salty', 1, 'heavy', 'high', IMG_CURRY)
    I['sadya'] = add('Kerala Meals (Sadya)', 'Traditional feast served on a banana leaf with an array of vegetarian dishes', 180, main_cat.key, 'veg', 'spicy', 2, 'heavy', 'high', IMG_THALI, True)

    # ---- Side Dishes & Curries ----
    I['kadala_curry'] = add('Kadala Curry', 'Black chickpea curry cooked in coconut-based gravy with aromatic spices', 120, sides_cat.key, 'veg', 'spicy', 3, 'medium', 'high', IMG_CURRY, True)
    I['veg_stew'] = add('Vegetable Stew', 'Mixed vegetables simmered in thin coconut milk with ginger and cinnamon', 130, sides_cat.key, 'veg', 'creamy', 2, 'medium', 'high', IMG_CURRY)
    I['chicken_stew'] = add('Chicken Stew', 'Tender chicken pieces in a fragrant coconut milk gravy with whole spices', 160, sides_cat.key, 'non-veg', 'creamy', 2, 'medium', 'high', IMG_CURRY)
    I['egg_curry'] = add('Egg Curry', 'Boiled eggs in a spicy onion-tomato coconut gravy', 100, sides_cat.key, 'non-veg', 'spicy', 3, 'medium', 'medium', IMG_CURRY)
    I['chicken_curry'] = add('Chicken Curry', 'Traditional Kerala chicken curry with coconut and curry leaves', 180, sides_cat.key, 'non-veg', 'spicy', 4, 'heavy', 'high', IMG_CURRY, True)
    I['beef_roast'] = add('Beef Roast', 'Slow-cooked beef in a dry, dark spice masala with coconut bits', 200, sides_cat.key, 'non-veg', 'spicy', 4, 'heavy', 'high', IMG_CURRY, True)
    I['egg_roast'] = add('Egg Roast', 'Boiled eggs tossed in a thick, spicy onion masala', 110, sides_cat.key, 'non-veg', 'spicy', 3, 'medium', 'medium', IMG_CURRY)
    I['meen_curry'] = add('Meen Curry (Fish Curry)', 'Fresh fish simmered in a tangy, spicy coconut and tamarind gravy', 200, sides_cat.key, 'non-veg', 'spicy', 4, 'medium', 'high', IMG_FISH, True)
    I['beef_curry'] = add('Beef Curry', 'Succulent beef in a rich coconut-based curry with Kerala spices', 200, sides_cat.key, 'non-veg', 'spicy', 4, 'heavy', 'high', IMG_CURRY)
    I['mutton_curry'] = add('Mutton Curry', 'Tender mutton slow-cooked in aromatic Kerala-style coconut gravy', 220, sides_cat.key, 'non-veg', 'spicy', 4, 'heavy', 'high', IMG_CURRY)
    I['fish_curry'] = add('Fish Curry', 'Kerala-style fish in a tangy tamarind and coconut base', 190, sides_cat.key, 'non-veg', 'spicy', 4, 'medium', 'medium', IMG_FISH)
    I['banana'] = add('Banana', 'Fresh ripe banana, the perfect side to balance spicy Kerala meals', 20, sides_cat.key, 'veg', 'sweet', 1, 'light', 'low', IMG_BANANA)
    I['papadam'] = add('Papadam', 'Crispy thin lentil cracker, deep-fried to golden perfection', 15, sides_cat.key, 'veg', 'salty', 1, 'light', 'low', IMG_SNACK)
    I['chammanthi'] = add('Chammanthi', 'Kerala-style dry coconut chutney with shallots and red chillies', 25, sides_cat.key, 'veg', 'spicy', 3, 'light', 'low', IMG)
    I['coconut_chutney'] = add('Coconut Chutney', 'Fresh ground coconut with green chillies, ginger, and curd', 25, sides_cat.key, 'veg', 'creamy', 1, 'light', 'medium', IMG)
    I['tomato_chutney'] = add('Tomato Chutney', 'Tangy-sweet tomato chutney tempered with mustard and curry leaves', 25, sides_cat.key, 'veg', 'sweet', 1, 'light', 'low', IMG)
    I['sambar'] = add('Sambar', 'Lentil and vegetable stew tempered with Kerala spices, a Sadya essential', 100, sides_cat.key, 'veg', 'spicy', 3, 'medium', 'high', IMG_CURRY, True)
    I['avial'] = add('Avial', 'Mixed vegetables cooked in yogurt and coconut, seasoned with coconut oil', 90, sides_cat.key, 'veg', 'creamy', 1, 'medium', 'high', IMG)
    I['thoran'] = add('Thoran', 'Stir-fried vegetables with grated coconut and green chillies', 70, sides_cat.key, 'veg', 'salty', 2, 'light', 'medium', IMG)
    I['olan'] = add('Olan', 'White pumpkin and cowpeas in thin coconut milk, mild and comforting', 80, sides_cat.key, 'veg', 'creamy', 1, 'light', 'medium', IMG)
    I['kalan'] = add('Kalan', 'Yogurt-based curry with raw banana and yam, thick and tangy', 90, sides_cat.key, 'veg', 'sour', 2, 'medium', 'medium', IMG)
    I['pachadi'] = add('Pachadi', 'Cooling yogurt-based side with cucumber or pineapple, sweet and tangy', 70, sides_cat.key, 'veg', 'sweet', 1, 'light', 'medium', IMG)
    I['pickle'] = add('Pickle', 'Spicy mango or lime pickle tempered with mustard seeds and asafoetida', 20, sides_cat.key, 'veg', 'spicy', 5, 'light', 'medium', IMG)
    I['payar'] = add('Payar (Green Gram)', 'Whole green gram cooked with coconut, tempered with curry leaves', 80, sides_cat.key, 'veg', 'salty', 1, 'medium', 'medium', IMG)
    I['payasam'] = add('Payasam', 'Creamy rice pudding with jaggery and coconut milk, Kerala-style dessert', 80, sides_cat.key, 'veg', 'sweet', 1, 'light', 'high', IMG_PAYASAM, True)

    # ---- Beverages ----
    I['black_tea'] = add('Black Tea (Kattan Chaya)', 'Strong black tea brewed with a hint of ginger and jaggery', 20, bev_cat.key, 'veg', 'creamy', 1, 'light', 'high', IMG_TEA, True)
    I['tea'] = add('Tea', 'Classic milk tea brewed with cardamom and fresh ginger', 20, bev_cat.key, 'veg', 'creamy', 1, 'light', 'high', IMG_TEA)
    I['filter_coffee'] = add('Filter Coffee', 'Traditional South Indian filter coffee with frothy boiled milk', 30, bev_cat.key, 'veg', 'creamy', 1, 'light', 'high', IMG_COFFEE, True)
    I['lime_juice'] = add('Lime Juice', 'Freshly squeezed lime juice with a hint of salt and cumin', 25, bev_cat.key, 'veg', 'sour', 1, 'light', 'medium', IMG_JUICE)
    I['mint_lime'] = add('Mint Lime Juice', 'Refreshing lime juice blended with fresh mint leaves', 30, bev_cat.key, 'veg', 'sour', 1, 'light', 'medium', IMG_JUICE)
    I['sambharam'] = add('Sambharam (Spiced Buttermilk)', 'Spiced buttermilk with ginger, green chilli, and curry leaves', 25, bev_cat.key, 'veg', 'salty', 2, 'light', 'high', IMG_JUICE)
    I['buttermilk'] = add('Buttermilk', 'Plain spiced buttermilk, a classic digestive after a heavy meal', 20, bev_cat.key, 'veg', 'sour', 1, 'light', 'medium', IMG_JUICE)
    I['toddy'] = add('Toddy (Kallu)', 'Traditional Kerala palm wine with a mild sweet-sour taste', 40, bev_cat.key, 'veg', 'sweet', 1, 'light', 'low', IMG_JUICE)

    # ---- Recommendations ----
    recs_ref = db_ref.child(f'restaurants/{res_id}/items')

    def set_recs(item_key, food_items, beverages):
        data = {}
        if food_items:
            data['food_items'] = {fid: {'priority': p} for fid, p in food_items.items()}
        if beverages:
            data['beverages'] = {bid: {'priority': p} for bid, p in beverages.items()}
        if data:
            recs_ref.child(f'{item_key}/recommendations').set(data)

    set_recs(I['puttu'], {
        I['kadala_curry']: 'high', I['banana']: 'medium', I['papadam']: 'low',
        I['chammanthi']: 'medium'
    }, {I['black_tea']: 'high'})

    set_recs(I['appam'], {
        I['veg_stew']: 'high', I['chicken_stew']: 'high', I['egg_curry']: 'medium'
    }, {I['tea']: 'high'})

    set_recs(I['idiyappam'], {
        I['egg_curry']: 'high', I['chicken_curry']: 'high', I['veg_stew']: 'medium'
    }, {I['tea']: 'high'})

    set_recs(I['parotta'], {
        I['beef_roast']: 'high', I['chicken_curry']: 'high', I['egg_roast']: 'medium'
    }, {I['lime_juice']: 'high'})

    set_recs(I['kappa'], {
        I['meen_curry']: 'high', I['beef_curry']: 'high', I['chammanthi']: 'medium'
    }, {I['black_tea']: 'high', I['toddy']: 'low'})

    set_recs(I['neychoru'], {
        I['chicken_curry']: 'high', I['beef_curry']: 'high', I['pickle']: 'medium'
    }, {I['mint_lime']: 'high'})

    set_recs(I['sadya'], {
        I['sambar']: 'high', I['avial']: 'high', I['thoran']: 'medium',
        I['olan']: 'medium', I['kalan']: 'medium', I['pachadi']: 'medium',
        I['pickle']: 'low', I['papadam']: 'low', I['payasam']: 'high'
    }, {I['sambharam']: 'high'})

    set_recs(I['dosa'], {
        I['sambar']: 'high', I['coconut_chutney']: 'high', I['tomato_chutney']: 'medium'
    }, {I['filter_coffee']: 'high'})

    set_recs(I['pathiri'], {
        I['chicken_curry']: 'high', I['mutton_curry']: 'high', I['fish_curry']: 'medium'
    }, {I['tea']: 'high'})

    set_recs(I['kanji'], {
        I['payar']: 'high', I['chammanthi']: 'medium', I['pickle']: 'low', I['papadam']: 'low'
    }, {I['buttermilk']: 'high'})

    print("Kerala cuisine seeded successfully with recommendations!")


if __name__ == '__main__':
    seed_kerala()
