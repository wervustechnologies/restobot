"""Backfill a per-restaurant ``tastes`` picklist from tastes already on items.

Restaurants that predate the owner-managed tastes feature have items tagged
with ``taste`` (legacy single string, or a list), but no ``tastes`` collection
to feed the chat/admin picklist. This scans each restaurant's items, collects
the distinct taste values actually in use, and pushes the ones missing from the
``tastes`` collection (idempotent, case-insensitive compare).

Items are NEVER modified — ``item.taste`` stays exactly as stored; the backend
reads it defensively. This only populates the ``tastes`` node so existing menus
keep their taste options without owners re-typing them.

Dry-run by default (prints what would be added, writes nothing). Pass ``--apply``
to write to Firebase. Optional: ``--restaurant=<id>`` to scope to one restaurant.

Run with:
    python backend/seed_tastes.py                 # dry-run preview
    python backend/seed_tastes.py --apply         # write to Firebase
    python backend/seed_tastes.py --apply --restaurant=<id>
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from firebase_client import get_db

# Emoji hints for the standard taste set; unknown tastes get an empty emoji.
STANDARD_EMOJI = {
    'spicy': '🌶️',
    'sweet': '🍯',
    'savoury': '🧂',
    'tangy': '🍋',
    'sour': '🍇',
    'salty': '🥨',
    'creamy': '🥛',
}


def normalize_taste_list(taste):
    """Normalize an item's taste field to a list of non-empty strings."""
    if taste is None:
        return []
    if isinstance(taste, list):
        return [str(t).strip() for t in taste if t is not None and str(t).strip()]
    val = str(taste).strip()
    return [val] if val else []


def collect_distinct_tastes(items):
    """Distinct taste values across items, deduped case-insensitively while
    preserving first-seen casing and order."""
    seen_lower = set()
    distinct = []
    for item in (items or {}).values():
        if not isinstance(item, dict):
            continue
        for t in normalize_taste_list(item.get('taste')):
            key = t.lower()
            if key not in seen_lower:
                seen_lower.add(key)
                distinct.append(t)
    return distinct


def seed_tastes(apply=False, restaurant_filter=None):
    db_ref = get_db()
    restaurants = db_ref.child('restaurants').get() or {}
    if not restaurants:
        print("No restaurants found.")
        return

    for rid, rdata in restaurants.items():
        if restaurant_filter and rid != restaurant_filter:
            continue
        if not isinstance(rdata, dict):
            continue

        label = rdata.get('name', rid)
        distinct = collect_distinct_tastes(rdata.get('items'))
        if not distinct:
            print(f"[{label}] no tastes on items; skipping.")
            continue

        existing = rdata.get('tastes') or {}
        existing_lower = {
            str(v.get('name', '')).lower() for v in existing.values() if isinstance(v, dict)
        }
        base_order = len(existing)

        to_add = []
        for name in distinct:
            if name.lower() in existing_lower:
                continue
            to_add.append({
                'name': name,
                'display_order': base_order + len(to_add),
                'emoji': STANDARD_EMOJI.get(name.lower(), ''),
            })

        if not to_add:
            print(f"[{label}] tastes already complete; no changes.")
            continue

        preview = ', '.join(
            f"{t['emoji']} {t['name']}" if t['emoji'] else t['name'] for t in to_add
        )
        if not apply:
            print(f"[{label}] DRY-RUN would add {len(to_add)}: {preview}")
            continue

        tastes_ref = db_ref.child(f'restaurants/{rid}/tastes')
        for entry in to_add:
            tastes_ref.push(entry)
        print(f"[{label}] added {len(to_add)}: {preview}")


def parse_args(argv):
    apply = False
    restaurant = None
    for arg in argv[1:]:
        if arg == '--apply':
            apply = True
        elif arg.startswith('--restaurant='):
            restaurant = arg.split('=', 1)[1]
    return apply, restaurant


if __name__ == '__main__':
    _apply, _restaurant = parse_args(sys.argv)
    if not _apply:
        print("DRY RUN — no writes. Pass --apply to write to Firebase.")
    seed_tastes(apply=_apply, restaurant_filter=_restaurant)
