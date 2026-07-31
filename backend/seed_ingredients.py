"""Backfill default main-ingredients into every existing restaurant.

Restaurants created before the ingredient feature (or imported without one) have
no `ingredients` node, so the AI chat and admin "Menu Setup" show nothing to pick.
This seeds a type-tailored default list into any restaurant that's missing one,
and defaults `restaurant_type` to 'mixed' where it is absent.

Idempotent: restaurants that already have at least one ingredient are skipped.

Run with:  python backend/seed_ingredients.py
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from firebase_client import get_db
from default_ingredients import build_default_ingredients

VALID_TYPES = {'veg', 'non-veg', 'mixed'}


def seed_ingredients():
    db_ref = get_db()
    restaurants = db_ref.child('restaurants').get() or {}
    if not restaurants:
        print("No restaurants found.")
        return

    seeded = 0
    skipped = 0
    for rid, rdata in restaurants.items():
        rtype = (rdata.get('restaurant_type') or '').strip().lower()
        if rtype not in VALID_TYPES:
            rtype = 'mixed'
            db_ref.child(f'restaurants/{rid}/restaurant_type').set('mixed')

        existing = rdata.get('ingredients')
        if existing:  # already has ingredients -> leave untouched
            skipped += 1
            continue

        entries = build_default_ingredients(rtype)
        ing_ref = db_ref.child(f'restaurants/{rid}/ingredients')
        for entry in entries:
            ing_ref.push(entry)
        seeded += 1
        names = ', '.join(e['name'] for e in entries)
        print(f"Seeded {len(entries)} ingredients ({rtype}) into {rdata.get('name', rid)}: {names}")

    print(f"\nDone. Seeded {seeded} restaurant(s); skipped {skipped} (already had ingredients).")


if __name__ == '__main__':
    seed_ingredients()
