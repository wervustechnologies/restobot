"""Tests for backend/seed_tastes.py — backfill the `tastes` picklist from items."""
import seed_tastes


def _items_with_mixed_tastes():
    return {
        "i1": {"name": "A", "taste": "spicy"},            # legacy string
        "i2": {"name": "B", "taste": ["spicy", "sweet"]}, # list
        "i3": {"name": "C", "taste": "Sweet"},            # case variant of 'sweet'
        "i4": {"name": "D"},                              # missing taste
    }


def test_seed_tastes_backfills_with_emoji_and_order(db):
    db.seed("restaurants/r1", {"name": "R1", "items": _items_with_mixed_tastes()})

    seed_tastes.seed_tastes(apply=True)

    tastes = db.read("restaurants/r1/tastes") or {}
    by_name = {v["name"]: v for v in tastes.values()}
    # distinct values, first-seen casing preserved ('sweet' from the list, not 'Sweet')
    assert sorted(by_name) == ["spicy", "sweet"]
    assert by_name["spicy"]["emoji"] == "🌶️"
    assert by_name["sweet"]["emoji"] == "🍯"
    # display_order continues from 0 (no existing tastes), distinct values
    orders = sorted(v["display_order"] for v in tastes.values())
    assert orders == [0, 1]


def test_seed_tastes_does_not_modify_items(db):
    db.seed("restaurants/r1", {"name": "R1", "items": _items_with_mixed_tastes()})
    seed_tastes.seed_tastes(apply=True)
    # Items are untouched — legacy strings/lists stay exactly as stored.
    assert db.read("restaurants/r1/items/i1/taste") == "spicy"
    assert db.read("restaurants/r1/items/i2/taste") == ["spicy", "sweet"]
    assert db.read("restaurants/r1/items/i3/taste") == "Sweet"


def test_seed_tastes_is_idempotent(db):
    db.seed("restaurants/r1", {"name": "R1", "items": _items_with_mixed_tastes()})
    seed_tastes.seed_tastes(apply=True)
    first = db.read("restaurants/r1/tastes") or {}
    # second run adds nothing (case-insensitive membership check)
    seed_tastes.seed_tastes(apply=True)
    second = db.read("restaurants/r1/tastes") or {}
    assert len(second) == len(first) == 2


def test_seed_tastes_respects_existing_collection(db):
    # A taste already present (case-insensitive) must not be re-pushed.
    db.seed("restaurants/r1", {
        "name": "R1",
        "tastes": {"x": {"name": "Spicy", "display_order": 0, "emoji": ""}},
        "items": {"i1": {"name": "A", "taste": "spicy"}, "i2": {"name": "B", "taste": "sweet"}},
    })
    seed_tastes.seed_tastes(apply=True)
    tastes = db.read("restaurants/r1/tastes") or {}
    by_name = {v["name"]: v for v in tastes.values()}
    assert sorted(by_name) == ["Spicy", "sweet"]  # existing casing kept, sweet added
    # existing entry display_order untouched; new one continues after existing count
    assert by_name["Spicy"]["display_order"] == 0
    assert by_name["sweet"]["display_order"] == 1


def test_seed_tastes_dry_run_writes_nothing(db):
    db.seed("restaurants/r1", {"name": "R1", "items": _items_with_mixed_tastes()})
    seed_tastes.seed_tastes(apply=False)  # default dry-run
    assert db.read("restaurants/r1/tastes") is None


def test_seed_tastes_restaurant_filter(db):
    db.seed("restaurants/r1", {"name": "R1", "items": {"i": {"name": "A", "taste": "spicy"}}})
    db.seed("restaurants/r2", {"name": "R2", "items": {"i": {"name": "B", "taste": "sweet"}}})
    seed_tastes.seed_tastes(apply=True, restaurant_filter="r2")
    assert db.read("restaurants/r1/tastes") is None  # filtered out
    assert (db.read("restaurants/r2/tastes") or {})  # processed
