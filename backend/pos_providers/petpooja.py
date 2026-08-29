"""Petpooja POS service.

Everything Petpooja-specific lives here: the HTTP call to fetchmenu, the
tolerant response parser, the menu upsert engine, and the dine-in order
payload mapper. pos_adapters.py reaches this module through the registry,
never the other way around.
"""
import json
import logging
import uuid

import requests
from requests import RequestException

from settings import settings

logger = logging.getLogger(__name__)


# =========================================================================
# CONFIRM AGAINST PETPOOJA DOCS
# -------------------------------------------------------------------------
# The API contract below could not be verified (Petpooja's Apiary docs are
# JS-gated and the provided base URL is an anonymous mock). Base URL comes
# from settings (PETPOOJA_API_BASE); everything else about the contract is
# confined to this block + the tolerant parser, so production cutover is a
# constants edit only.
# =========================================================================
FETCHMENU_PATH = '/fetchmenu'
GETTABLEINFO_PATH = '/gettableinfo'
# Credential -> request JSON body key.
AUTH_BODY_KEYS = {
    'app_key': 'AppKey',
    'app_secret': 'AppSecret',
    'access_token': 'AccessToken',
    'restID': 'restID',
}

PETPOOJA_MAIN_CATEGORY_NAME = 'Petpooja Menu'
DEFAULT_SUBCATEGORY_NAME = 'Uncategorized'
PETPOOJA_CRED_FIELDS = ('app_key', 'app_secret', 'access_token', 'restID')

_WRAPPER_KEYS = ('data', 'menu', 'items', 'result')
_NAME_KEYS = ('name', 'item_name', 'itemName', 'itemname', 'title')
_PRICE_KEYS = ('base_price', 'price', 'item_price', 'rate')
_CATEGORY_KEYS = ('category', 'category_name', 'categoryName', 'menu_category')
# 'active' before 'in_stock': Petpooja uses active="0"/"1" while in_stock may
# carry other numeric codes that the parser would silently default on.
_AVAILABLE_KEYS = ('is_available', 'available', 'is_active', 'isActive', 'active', 'in_stock')
_TYPE_KEYS = ('item_type', 'food_type', 'type')
_ID_KEYS = ('petpooja_id', 'item_id', 'food_id', 'id', 'itemid')
_GST_LIABILITY_KEYS = ('gst_liability', 'liability')
_CGST_KEYS = ('cgst_percentage', 'cgst', 'CGST')
_SGST_KEYS = ('sgst_percentage', 'sgst', 'SGST')

_TABLE_WRAPPER_KEYS = ('data', 'tables', 'tableinfo', 'table_info', 'result')
_TABLE_ID_KEYS = ('petpooja_table_id', 'table_id', 'tableid', 'id')
_TABLE_NAME_KEYS = ('table_name', 'tablename', 'name', 'table_no', 'table_number')

_TRUE = ('yes', 'true', '1', 'y', 't')
_FALSE = ('no', 'false', '0', 'n', 'f')


class PetpoojaApiError(Exception):
    """Petpooja could not be reached / returned an unusable response (-> 502)."""


# --------------------------------------------------------------------------
# Small value helpers
# --------------------------------------------------------------------------
def _norm(s):
    return str(s).strip().lower() if s is not None else ''


def _first(entry, keys, default=None):
    for key in keys:
        if key in entry and entry[key] is not None:
            return entry[key]
    return default


def _parse_price(v):
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    try:
        p = float(v)
    except (TypeError, ValueError):
        return None
    if p != p or p < 0:
        return None
    return int(p) if float(p).is_integer() else p


def _parse_percent(v):
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    try:
        p = float(v)
    except (TypeError, ValueError):
        return None
    return None if p != p else p


def _parse_available(v, default=True):
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    key = _norm(v)
    if key in _TRUE:
        return True
    if key in _FALSE:
        return False
    return default


def _parse_item_type(v):
    key = _norm(v)
    if not key or key in ('veg', 'vegetarian'):
        return 'veg'
    if key in ('non-veg', 'nonveg', 'non_veg', 'non-vegetarian', 'nonvegetarian'):
        return 'non-veg'
    return 'mixed'


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------
def _strip_js_comments(text):
    """Remove // and /* */ comments that appear outside string literals.

    Petpooja's documented samples (and the Apiary mock captured from them)
    embed JS-style comments inside the JSON body, which json.loads rejects.
    """
    out = []
    i = 0
    n = len(text)
    in_string = False
    while i < n:
        ch = text[i]
        if in_string:
            out.append(ch)
            if ch == '\\' and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if ch == '"':
                in_string = False
            i += 1
        elif ch == '"':
            in_string = True
            out.append(ch)
            i += 1
        elif ch == '/' and text[i:i + 2] == '//':
            while i < n and text[i] != '\n':
                i += 1
        elif ch == '/' and text[i:i + 2] == '/*':
            end = text.find('*/', i + 2)
            i = n if end == -1 else end + 2
        else:
            out.append(ch)
            i += 1
    return ''.join(out)


def _post(path, credentials):
    """POST the stored credentials to a Petpooja endpoint, return raw JSON.

    Raises PetpoojaApiError on connection failure, non-2xx status, or a body
    that is not valid JSON.
    """
    base = (settings.petpooja_api_base or '').rstrip('/')
    if not base:
        raise PetpoojaApiError('Petpooja API is not configured.')
    body = {AUTH_BODY_KEYS[f]: str(credentials.get(f) or '') for f in PETPOOJA_CRED_FIELDS}
    try:
        resp = requests.post(base + path, json=body, timeout=settings.petpooja_timeout_seconds)
    except RequestException as e:
        raise PetpoojaApiError(f'Could not reach Petpooja: {e}') from e
    if not 200 <= resp.status_code < 300:
        raise PetpoojaApiError(f'Petpooja returned HTTP {resp.status_code}.')
    try:
        return json.loads(_strip_js_comments(resp.text))
    except ValueError as e:
        snippet = ' '.join((resp.text or '').split())[:200]
        content_type = resp.headers.get('Content-Type', 'unknown')
        logger.error('Petpooja %s returned unparseable body (content-type=%s): %r',
                     path, content_type, snippet)
        raise PetpoojaApiError(
            f'Petpooja returned an invalid response '
            f'(content-type={content_type}, body starts with: {snippet!r}).'
        ) from e


def fetch_menu(credentials):
    """POST the stored credentials to fetchmenu and return the raw JSON."""
    return _post(FETCHMENU_PATH, credentials)


def fetch_tables(credentials):
    """POST the stored credentials to gettableinfo and return the raw JSON."""
    return _post(GETTABLEINFO_PATH, credentials)


# --------------------------------------------------------------------------
# Parsing
# --------------------------------------------------------------------------
def _unwrap_items(raw):
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for key in _WRAPPER_KEYS:
            val = raw.get(key)
            if isinstance(val, list):
                return val
    return None


def _category_names(raw):
    """Map Petpooja categoryid -> categoryname from the response's categories list."""
    if not isinstance(raw, dict):
        return {}
    names = {}
    for cat in raw.get('categories') or []:
        if isinstance(cat, dict):
            cid = str(cat.get('categoryid') or cat.get('id') or '').strip()
            name = str(cat.get('categoryname') or cat.get('name') or '').strip()
            if cid and name:
                names[cid] = name
    return names


def _taxes_by_id(raw):
    """Map Petpooja taxid -> (normalized taxname, percent) from the taxes list."""
    if not isinstance(raw, dict):
        return {}
    taxes = {}
    for tax in raw.get('taxes') or []:
        if isinstance(tax, dict):
            tid = str(tax.get('taxid') or '').strip()
            if tid:
                taxes[tid] = (_norm(tax.get('taxname')), _parse_percent(tax.get('tax')))
    return taxes


def _resolve_taxes(row, taxes_by_id, cgst, sgst):
    """Fill missing cgst/sgst from the row's item_tax id list (e.g. '11213,20375')."""
    for tid in str(row.get('item_tax') or '').split(','):
        info = taxes_by_id.get(tid.strip())
        if not info or info[1] is None:
            continue
        name, pct = info
        if 'cgst' in name and cgst is None:
            cgst = pct
        elif 'sgst' in name and sgst is None:
            sgst = pct
    return cgst, sgst


def parse_menu(raw):
    """Normalize the raw fetchmenu response into (entries, failures).

    Tolerates the common wrapper shapes and field spellings. Entries without
    a usable name / petpooja_id / price become failure records and never
    abort the rest of the sync.
    """
    rows = _unwrap_items(raw)
    if rows is None:
        raise PetpoojaApiError('Petpooja response did not contain a menu list.')

    cat_names = _category_names(raw)
    taxes_by_id = _taxes_by_id(raw)

    entries = []
    failures = []
    for row in rows:
        if not isinstance(row, dict):
            failures.append({'name': '', 'reason': 'Invalid entry'})
            continue

        name = str(_first(row, _NAME_KEYS, '') or '').strip()
        petpooja_id = str(_first(row, _ID_KEYS, '') or '').strip()
        if not name:
            failures.append({'name': '', 'reason': 'Missing name'})
            continue
        if not petpooja_id:
            failures.append({'name': name, 'reason': 'Missing petpooja_id'})
            continue
        price = _parse_price(_first(row, _PRICE_KEYS))
        if price is None:
            failures.append({'name': name, 'reason': 'Invalid price'})
            continue

        category = str(_first(row, _CATEGORY_KEYS, '') or '').strip()
        if not category:
            category = cat_names.get(str(row.get('item_categoryid') or '').strip(), '')

        cgst = _parse_percent(_first(row, _CGST_KEYS))
        sgst = _parse_percent(_first(row, _SGST_KEYS))
        if cgst is None or sgst is None:
            cgst, sgst = _resolve_taxes(row, taxes_by_id, cgst, sgst)

        entries.append({
            'name': name,
            'price': price,
            'category': category,
            'available': _parse_available(_first(row, _AVAILABLE_KEYS), True),
            'item_type': _parse_item_type(_first(row, _TYPE_KEYS)),
            'petpooja_id': petpooja_id,
            'gst_liability': str(_first(row, _GST_LIABILITY_KEYS, '') or '').strip(),
            'cgst_percentage': cgst,
            'sgst_percentage': sgst,
        })
    return entries, failures


# --------------------------------------------------------------------------
# Menu sync (upsert by petpooja_id)
# --------------------------------------------------------------------------
def _max_order(d):
    vals = [(v.get('display_order') or 0) for v in (d or {}).values() if v]
    return max(vals) if vals else 0


def _mapping_for(entry):
    return {
        'petpooja_id': entry['petpooja_id'],
        'gst_liability': entry.get('gst_liability', ''),
        'cgst_percentage': entry.get('cgst_percentage'),
        'sgst_percentage': entry.get('sgst_percentage'),
    }


def sync_menu(db_ref, restaurant_id, entries):
    """Upsert normalized Petpooja entries into restaurants/{rid}/items.

    Matched (same petpooja_mapping.petpooja_id) items update only
    name/price/is_enabled/category/petpooja_mapping — local enrichment
    (taste, recommendations, images, ...) is preserved. New Petpooja items
    are created under the auto-managed "Petpooja Menu" main category with
    one sub-category per Petpooja category. Local-only items are untouched.
    """
    base = f'restaurants/{restaurant_id}'

    items = db_ref.child(f'{base}/items').get() or {}
    by_pid = {}
    used_names = set()
    for iid, it in items.items():
        if not it:
            continue
        pid = str(((it.get('petpooja_mapping') or {}).get('petpooja_id')) or '')
        if pid:
            by_pid[pid] = iid
        if it.get('name'):
            used_names.add(_norm(it['name']))

    main_cats = db_ref.child(f'{base}/main_categories').get() or {}
    main_id = next(
        (cid for cid, v in main_cats.items()
         if v and _norm(v.get('name')) == _norm(PETPOOJA_MAIN_CATEGORY_NAME)),
        None
    )
    if not main_id:
        main_id = db_ref.child(f'{base}/main_categories').push({
            'name': PETPOOJA_MAIN_CATEGORY_NAME,
            'display_order': _max_order(main_cats) + 1,
        }).key

    cats = db_ref.child(f'{base}/categories').get() or {}
    sub_cache = {}
    max_sub_order = 0
    for cid, v in cats.items():
        if not v or v.get('main_category_id') != main_id or not v.get('name'):
            continue
        sub_cache[_norm(v['name'])] = cid
        max_sub_order = max(max_sub_order, v.get('display_order') or 0)

    added = updated = failed = 0
    added_names = []
    failures = []

    for entry in entries:
        name = entry['name']
        mapping = _mapping_for(entry)

        sub_name = entry.get('category') or DEFAULT_SUBCATEGORY_NAME
        sub_id = sub_cache.get(_norm(sub_name))
        if not sub_id:
            max_sub_order += 1
            sub_id = db_ref.child(f'{base}/categories').push({
                'name': sub_name,
                'main_category_id': main_id,
                'display_order': max_sub_order,
            }).key
            sub_cache[_norm(sub_name)] = sub_id

        existing_id = by_pid.get(entry['petpooja_id'])
        if existing_id:
            db_ref.child(f'{base}/items/{existing_id}').update({
                'name': name,
                'price': entry['price'],
                'is_enabled': entry['available'],
                'main_category_id': main_id,
                'category_id': sub_id,
                'petpooja_mapping': mapping,
            })
            updated += 1
            continue

        if _norm(name) in used_names:
            failed += 1
            failures.append({'name': name, 'reason': 'Duplicate name'})
            continue

        new_ref = db_ref.child(f'{base}/items').push({
            'name': name,
            'description': '',
            'price': entry['price'],
            'main_category_id': main_id,
            'category_id': sub_id,
            'item_type': entry.get('item_type') or 'veg',
            'main_ingredient': '',
            'cuisine': '',
            'taste': [],
            'heaviness': 'medium',
            'priority': 'medium',
            'is_enabled': entry['available'],
            'is_bestseller': False,
            'image_url': '',
            'spice_level': 0,
            'petpooja_mapping': mapping,
        })
        by_pid[entry['petpooja_id']] = new_ref.key
        used_names.add(_norm(name))
        added += 1
        added_names.append(name)

    return {
        'added': added,
        'updated': updated,
        'failed': failed,
        'total': added + updated + failed,
        'added_names': added_names,
        'failures': failures,
    }


def sync_from_pos(db_ref, restaurant_id, credentials):
    """End-to-end menu sync entrypoint registered in POS_MENU_SYNCERS."""
    credentials = credentials or {}
    if any(not str(credentials.get(f) or '').strip() for f in PETPOOJA_CRED_FIELDS):
        raise ValueError('Petpooja credentials are incomplete.')

    raw = fetch_menu(credentials)
    entries, parse_failures = parse_menu(raw)
    report = sync_menu(db_ref, restaurant_id, entries)
    for failure in parse_failures:
        report['failures'].append(failure)
        report['failed'] += 1
    report['total'] = report['added'] + report['updated'] + report['failed']
    return report


# --------------------------------------------------------------------------
# Table sync (upsert by petpooja_table_id, link by table_number)
# --------------------------------------------------------------------------
def _unwrap_tables(raw):
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for key in _TABLE_WRAPPER_KEYS:
            val = raw.get(key)
            if isinstance(val, list):
                return val
    return None


def parse_tables(raw):
    """Normalize the raw gettableinfo response into (entries, failures).

    Each entry carries the Petpooja table id plus a display table_number
    (Petpooja's table_name when present, else the id). Tolerates the common
    wrapper shapes and field spellings, mirroring parse_menu.
    """
    rows = _unwrap_tables(raw)
    if rows is None:
        raise PetpoojaApiError('Petpooja response did not contain a table list.')

    entries = []
    failures = []
    for row in rows:
        if not isinstance(row, dict):
            failures.append({'name': '', 'reason': 'Invalid entry'})
            continue
        petpooja_table_id = str(_first(row, _TABLE_ID_KEYS, '') or '').strip()
        name = str(_first(row, _TABLE_NAME_KEYS, '') or '').strip()
        if not petpooja_table_id:
            failures.append({'name': name, 'reason': 'Missing petpooja_table_id'})
            continue
        entries.append({
            'petpooja_table_id': petpooja_table_id,
            'table_number': name or petpooja_table_id,
        })
    return entries, failures


def sync_tables(db_ref, restaurant_id, entries):
    """Upsert normalized Petpooja tables into restaurants/{rid}/tables.

    Existing tables are matched by petpooja_mapping.petpooja_table_id first,
    then by table_number — so locally created tables whose number matches
    Petpooja's are linked in place and keep their QR token. New tables get a
    fresh qr_token plus the table_tokens lookup entry the QR flow needs.
    """
    base = f'restaurants/{restaurant_id}'

    tables = db_ref.child(f'{base}/tables').get() or {}
    by_pid = {}
    by_number = {}
    pid_by_tid = {}
    for tid, t in tables.items():
        if not t:
            continue
        pid = str(((t.get('petpooja_mapping') or {}).get('petpooja_table_id')) or '')
        if pid:
            by_pid[pid] = tid
            pid_by_tid[tid] = pid
        if t.get('table_number') is not None:
            by_number.setdefault(_norm(t['table_number']), tid)

    added = updated = failed = 0
    added_names = []
    failures = []

    for entry in entries:
        mapping = {'petpooja_table_id': entry['petpooja_table_id']}
        existing_id = by_pid.get(entry['petpooja_table_id'])
        if not existing_id:
            number_id = by_number.get(_norm(entry['table_number']))
            if number_id:
                owner_pid = pid_by_tid.get(number_id)
                if owner_pid and owner_pid != entry['petpooja_table_id']:
                    # The number is already claimed by a different Petpooja
                    # table — never silently rebind the existing mapping.
                    failed += 1
                    failures.append({'name': entry['table_number'], 'reason': 'Duplicate table number'})
                    continue
                existing_id = number_id

        if existing_id:
            db_ref.child(f'{base}/tables/{existing_id}').update({
                'table_number': entry['table_number'],
                'petpooja_mapping': mapping,
            })
            token = (tables.get(existing_id) or {}).get('qr_token')
            if not token:
                token = str(uuid.uuid4())
                db_ref.child(f'{base}/tables/{existing_id}/qr_token').set(token)
            db_ref.child(f'table_tokens/{token}').update({
                'restaurant_id': restaurant_id,
                'table_number': entry['table_number'],
                'table_id': existing_id,
            })
            by_pid[entry['petpooja_table_id']] = existing_id
            by_number[_norm(entry['table_number'])] = existing_id
            pid_by_tid[existing_id] = entry['petpooja_table_id']
            updated += 1
            continue

        token = str(uuid.uuid4())
        new_ref = db_ref.child(f'{base}/tables').push({
            'table_number': entry['table_number'],
            'qr_token': token,
            'petpooja_mapping': mapping,
        })
        db_ref.child(f'table_tokens/{token}').set({
            'restaurant_id': restaurant_id,
            'table_number': entry['table_number'],
            'table_id': new_ref.key,
        })
        by_pid[entry['petpooja_table_id']] = new_ref.key
        by_number[_norm(entry['table_number'])] = new_ref.key
        pid_by_tid[new_ref.key] = entry['petpooja_table_id']
        added += 1
        added_names.append(entry['table_number'])

    return {
        'added': added,
        'updated': updated,
        'failed': failed,
        'total': added + updated + failed,
        'added_names': added_names,
        'failures': failures,
    }


def sync_tables_from_pos(db_ref, restaurant_id, credentials):
    """End-to-end table sync entrypoint registered in POS_TABLE_SYNCERS."""
    credentials = credentials or {}
    if any(not str(credentials.get(f) or '').strip() for f in PETPOOJA_CRED_FIELDS):
        raise ValueError('Petpooja credentials are incomplete.')

    raw = fetch_tables(credentials)
    entries, parse_failures = parse_tables(raw)
    report = sync_tables(db_ref, restaurant_id, entries)
    for failure in parse_failures:
        report['failures'].append(failure)
        report['failed'] += 1
    report['total'] = report['added'] + report['updated'] + report['failed']
    return report


# --------------------------------------------------------------------------
# Order mapping (dine-in)
# --------------------------------------------------------------------------
def map_order_payload(order_data, item_mappings, credentials, table_mapping=None):
    """Build the Petpooja dine-in order body from a Dishlyst order.

    item_mappings maps the cart item's Dishlyst item id to its
    petpooja_mapping; items without a mapping are still included with
    petpooja_id None so nothing is silently dropped. table_mapping is the
    local table's petpooja_mapping; when present its petpooja_table_id is
    sent as table_id so Petpooja recognises its own table.
    """
    credentials = credentials or {}
    table_mapping = table_mapping or {}
    petpooja_table_id = str(table_mapping.get('petpooja_table_id') or '').strip()
    mapped_items = []
    for it in (order_data.get('items') or []):
        if not isinstance(it, dict):
            continue
        mapping = (item_mappings or {}).get(it.get('id')) or {}
        petpooja_id = str(mapping.get('petpooja_id') or '').strip()
        mapped_items.append({
            'petpooja_id': petpooja_id or None,
            'name': it.get('name', ''),
            'quantity': it.get('quantity', 1),
            'price': it.get('price', 0),
            'gst_liability': mapping.get('gst_liability', ''),
            'cgst_percentage': mapping.get('cgst_percentage'),
            'sgst_percentage': mapping.get('sgst_percentage'),
        })
    return {
        'restID': str(credentials.get('restID') or ''),
        'order_type': 'dinein',
        'table_id': petpooja_table_id or None,
        'table_number': order_data.get('table_number'),
        'user_name': order_data.get('user_name', ''),
        'total_amount': order_data.get('total_amount', 0),
        'items': mapped_items,
    }
