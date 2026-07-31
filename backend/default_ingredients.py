"""Default main-ingredient vocabularies, seeded into every new restaurant.

Seeded at restaurant-creation time (see routes/superadmin.py) so the menu
admin has a sensible starter list to tag items against, instead of typing each
ingredient from scratch. The set is chosen by the restaurant's ``restaurant_type``.

Stored per-restaurant under ``restaurants/{id}/ingredients`` as
``{key: {name, display_order}}``; the admin may add/edit/remove entries later.
"""

# Veg restaurants (no meat/seafood/egg).
DEFAULT_INGREDIENTS_VEG = [
    "Paneer",
    "Mushroom",
    "Potato",
    "Vegetables",
    "Lentils/Dal",
    "Tofu",
    "Soya",
    "Cheese",
]

# Non-veg or mixed restaurants (meat/seafood/egg + a few veg staples).
DEFAULT_INGREDIENTS_NON_VEG = [
    "Chicken",
    "Mutton",
    "Beef",
    "Fish",
    "Prawns",
    "Egg",
    "Paneer",
    "Vegetables",
]


def default_ingredients_for(restaurant_type):
    """Return the ordered default ingredient names for a restaurant type.

    Unknown/missing types fall back to the non-veg set (the most inclusive).
    """
    if restaurant_type == "veg":
        return list(DEFAULT_INGREDIENTS_VEG)
    return list(DEFAULT_INGREDIENTS_NON_VEG)


def build_default_ingredients(restaurant_type):
    """Return a list of ``{name, display_order}`` dicts ready to push to RTDB."""
    return [
        {"name": name, "display_order": idx}
        for idx, name in enumerate(default_ingredients_for(restaurant_type))
    ]
