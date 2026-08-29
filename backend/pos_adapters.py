"""POS adapter/strategy layer.

Order creation and menu sync are routed through the restaurant's configured
POS provider (restaurants/{rid}/pos_integration.provider). Add a new POS by
implementing a service module under pos_providers/ and registering it in
POS_ADAPTERS / POS_MENU_SYNCERS; routes never change.
"""
from pos_providers import petpooja


def get_pos_integration(db_ref, restaurant_id):
    node = db_ref.child(f'restaurants/{restaurant_id}/pos_integration').get() or {}
    provider = node.get('provider') or 'native'
    credentials = node.get('credentials') or {}
    return provider, credentials


def handle_native_order(db_ref, restaurant_id, order_data, credentials=None):
    order_ref = db_ref.child(f'restaurants/{restaurant_id}/orders').push(order_data)
    return order_ref.key, order_data


def _resolve_item_mappings(db_ref, restaurant_id, order_items):
    """One read of the items node -> {item_id: petpooja_mapping} for this order."""
    ids = {it.get('id') for it in (order_items or []) if isinstance(it, dict) and it.get('id')}
    if not ids:
        return {}
    items = db_ref.child(f'restaurants/{restaurant_id}/items').get() or {}
    mappings = {}
    for item_id in ids:
        mapping = (items.get(item_id) or {}).get('petpooja_mapping')
        if mapping:
            mappings[item_id] = mapping
    return mappings


def _resolve_table_mapping(db_ref, restaurant_id, table_number):
    """The local table's petpooja_mapping, found by table_number (or None).

    Skips matching tables without a mapping so ambiguous/duplicate rows
    never shadow a properly mapped one.
    """
    if table_number in (None, ''):
        return None
    tables = db_ref.child(f'restaurants/{restaurant_id}/tables').get() or {}
    for table in tables.values():
        if table and str(table.get('table_number')) == str(table_number):
            mapping = table.get('petpooja_mapping')
            if mapping:
                return mapping
    return None


def handle_petpooja_order(db_ref, restaurant_id, order_data, credentials=None):
    credentials = credentials or {}
    item_mappings = _resolve_item_mappings(db_ref, restaurant_id, order_data.get('items'))
    table_mapping = _resolve_table_mapping(db_ref, restaurant_id, order_data.get('table_number'))
    payload = petpooja.map_order_payload(order_data, item_mappings, credentials, table_mapping)
    print('[Petpooja] dine-in order payload:', payload)
    print('[Petpooja] credentials:', credentials)
    # Placeholder: keep persisting locally until the real Petpooja order API
    # replaces the prints above.
    return handle_native_order(db_ref, restaurant_id, order_data)


POS_ADAPTERS = {
    'native': handle_native_order,
    'petpooja': handle_petpooja_order,
}

POS_MENU_SYNCERS = {
    'petpooja': petpooja.sync_from_pos,
}

POS_TABLE_SYNCERS = {
    'petpooja': petpooja.sync_tables_from_pos,
}


def route_order_to_pos(db_ref, restaurant_id, order_data):
    provider, credentials = get_pos_integration(db_ref, restaurant_id)
    handler = POS_ADAPTERS.get(provider, handle_native_order)
    return handler(db_ref, restaurant_id, order_data, credentials)


def sync_menu_from_pos(db_ref, restaurant_id):
    provider, credentials = get_pos_integration(db_ref, restaurant_id)
    syncer = POS_MENU_SYNCERS.get(provider)
    if syncer is None:
        raise ValueError('No POS configured. Select a POS provider first.')
    return syncer(db_ref, restaurant_id, credentials)


def sync_tables_from_pos(db_ref, restaurant_id):
    provider, credentials = get_pos_integration(db_ref, restaurant_id)
    syncer = POS_TABLE_SYNCERS.get(provider)
    if syncer is None:
        raise ValueError('No POS configured. Select a POS provider first.')
    return syncer(db_ref, restaurant_id, credentials)
