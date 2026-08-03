"""Shared helpers for menu item recommendations.

Recommendations are stored on each item as a flat map:
    { "<companion_item_id>": { "priority": "high" | "medium" | "low" } }

Older seed/demo data used the legacy two-bucket shape:
    { "food_items": {...}, "beverages": {...} }
`normalize_recs` flattens that legacy shape so the rest of the app can always
treat recommendations as a single map (no data migration required).
"""


def normalize_recs(recs):
    if not recs:
        return {}
    if 'food_items' in recs or 'beverages' in recs:
        flat = {}
        for key in ('food_items', 'beverages'):
            for rec_id, rec_data in (recs.get(key) or {}).items():
                if rec_id not in flat:
                    flat[rec_id] = rec_data
        return flat
    return recs


def normalize_taste(taste):
    """Normalize an item's ``taste`` field to a list of name-strings.

    Legacy items stored a single string (e.g. ``"spicy"``); newer items store a
    list (e.g. ``["spicy", "sweet"]``). This is a read-only normalization — the
    stored value is never written back — so existing data keeps working without
    a migration. Missing/None becomes ``[]``.
    """
    if taste is None:
        return []
    if isinstance(taste, list):
        return [str(t) for t in taste if t is not None and str(t) != ""]
    return [str(taste)] if str(taste) != "" else []
