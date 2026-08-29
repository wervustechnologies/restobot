"""Clear all orders for a restaurant.

Run with:  python backend/clear_orders.py <restaurant_id> [--yes] [--dry-run]

Deletes the restaurants/{restaurant_id}/orders node and bumps the orders rev
counter so connected frontends refetch. Use --dry-run first to preview the count
without deleting anything.
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from firebase_client import get_db, bump_rev


def clear_orders(restaurant_id, assume_yes=False, dry_run=False):
    db_ref = get_db()

    restaurant = db_ref.child(f'restaurants/{restaurant_id}').get()
    if not restaurant:
        print(f"ERROR: No restaurant found with id '{restaurant_id}'.")
        sys.exit(1)

    orders = db_ref.child(f'restaurants/{restaurant_id}/orders').get() or {}
    count = len(orders)
    name = restaurant.get('name') or '(unnamed)'
    print(f"Restaurant: {name} ({restaurant_id})")
    print(f"Orders found: {count}")

    if count == 0:
        print("Nothing to clear.")
        return

    if dry_run:
        print("[dry-run] No changes made.")
        return

    if not assume_yes:
        confirm = input(f"Delete ALL {count} orders for '{name}'? Type the restaurant id to confirm: ").strip()
        if confirm != restaurant_id:
            print("Cancelled. Input did not match the restaurant id.")
            sys.exit(1)

    db_ref.child(f'restaurants/{restaurant_id}/orders').delete()
    bump_rev(restaurant_id, 'orders')
    print(f"Cleared {count} orders and bumped the orders rev counter.")


def main():
    # Parse manually: Firebase restaurant ids start with '-', so argparse
    # misreads the id as an unknown option. Only the short flags below are
    # recognized; everything else is treated as the restaurant id.
    args = sys.argv[1:]
    assume_yes = False
    dry_run = False
    restaurant_id = None
    flags = {"-y", "--yes", "--dry-run"}

    for arg in args:
        if arg in ("-h", "--help"):
            print("Usage: clear_orders.py <restaurant_id> [-y] [--dry-run]")
            sys.exit(0)
        elif arg in ("-y", "--yes"):
            assume_yes = True
        elif arg == "--dry-run":
            dry_run = True
        elif arg not in flags and restaurant_id is None:
            restaurant_id = arg

    if not restaurant_id:
        print("Usage: clear_orders.py <restaurant_id> [-y] [--dry-run]")
        print("Error: restaurant_id is required.")
        sys.exit(2)

    clear_orders(restaurant_id, assume_yes=assume_yes, dry_run=dry_run)


if __name__ == '__main__':
    main()
