"""Tests for pos_providers/petpooja.py + the /admin/menu/fetch-pos endpoint.

The HTTP layer is always stubbed (either fetch_menu is monkeypatched or a
fake requests module is injected) — these tests never touch the network.
"""
import json

import pytest
import requests as requests_lib

from pos_providers import petpooja
from pos_providers.petpooja import PetpoojaApiError


SAMPLE_RAW = [
    {
        "item_id": "7765862",
        "name": "Garlic Bread",
        "base_price": 140,
        "is_available": True,
        "category": "Starters",
        "gst_liability": "vendor",
        "cgst_percentage": 2.5,
        "sgst_percentage": 2.5,
    },
    {
        "item_id": "7765863",
        "name": "Masala Chai",
        "base_price": 25,
        "is_available": False,
        "category": "Beverages",
        "gst_liability": "restaurant",
        "cgst_percentage": 2.5,
        "sgst_percentage": 2.5,
    },
]

FULL_CREDS = {"app_key": "k", "app_secret": "s", "access_token": "t", "restID": "R99"}


def _seed_petpooja_r1(db):
    db.seed("restaurants/r1/pos_integration", {
        "provider": "petpooja",
        "credentials": FULL_CREDS,
    })


# ----------------------------- fetch_menu ------------------------------
class _StubResponse:
    def __init__(self, status_code=200, payload=None, bad_json=False, text=None):
        self.status_code = status_code
        if text is not None:
            self.text = text
        elif bad_json:
            self.text = '{"data": '  # truncated -> invalid JSON
        else:
            self.text = json.dumps(payload)
        self.headers = {"Content-Type": "application/json"}

    def json(self):
        return json.loads(self.text)


def _stub_requests(monkeypatch, response=None, exc=None, captured=None):
    class _StubRequests:
        @staticmethod
        def post(url, **kwargs):
            if captured is not None:
                captured.update({"url": url, **kwargs})
            if exc is not None:
                raise exc
            return response
    monkeypatch.setattr(petpooja, "requests", _StubRequests)


def test_fetch_menu_sends_credentials_and_returns_json(monkeypatch):
    captured = {}
    _stub_requests(monkeypatch, response=_StubResponse(payload={"data": []}), captured=captured)
    raw = petpooja.fetch_menu(FULL_CREDS)
    assert raw == {"data": []}
    assert captured["url"].endswith("/fetchmenu")
    assert captured["json"] == {"AppKey": "k", "AppSecret": "s", "AccessToken": "t", "restID": "R99"}


def test_fetch_menu_non_2xx_raises(monkeypatch):
    _stub_requests(monkeypatch, response=_StubResponse(status_code=401))
    with pytest.raises(PetpoojaApiError):
        petpooja.fetch_menu(FULL_CREDS)


def test_fetch_menu_connection_error_raises(monkeypatch):
    _stub_requests(monkeypatch, exc=requests_lib.RequestException("boom"))
    with pytest.raises(PetpoojaApiError):
        petpooja.fetch_menu(FULL_CREDS)


def test_fetch_menu_invalid_json_raises(monkeypatch):
    _stub_requests(monkeypatch, response=_StubResponse(bad_json=True))
    with pytest.raises(PetpoojaApiError):
        petpooja.fetch_menu(FULL_CREDS)


def test_fetch_menu_strips_js_comments(monkeypatch):
    # Apiary mock embeds // comments (copied from Petpooja's docs) in the body.
    body = '''{
        "items": [
            {"itemid": "1", "itemname": "Pizza", "price": "100"}, // trailing note
            /* block
               comment */
            {"itemid": "2", "itemname": "Cake", "price": "310"}
        ]
    }'''
    _stub_requests(monkeypatch, response=_StubResponse(text=body))
    raw = petpooja.fetch_menu(FULL_CREDS)
    assert [it["itemname"] for it in raw["items"]] == ["Pizza", "Cake"]


def test_fetch_menu_preserves_slashes_inside_strings(monkeypatch):
    body = '{"items": [{"id": "1", "name": "See http://x.com//y", "price": 5, "url": "https://a/*b*/c"}]}'
    _stub_requests(monkeypatch, response=_StubResponse(text=body))
    raw = petpooja.fetch_menu(FULL_CREDS)
    assert raw["items"][0]["name"] == "See http://x.com//y"
    assert raw["items"][0]["url"] == "https://a/*b*/c"


def test_fetch_menu_unconfigured_base(monkeypatch):
    from settings import settings as app_settings
    monkeypatch.setattr(app_settings, "petpooja_api_base", "")
    with pytest.raises(PetpoojaApiError):
        petpooja.fetch_menu(FULL_CREDS)


# ----------------------------- parse_menu ------------------------------
def test_parse_menu_top_level_list():
    entries, failures = petpooja.parse_menu(SAMPLE_RAW)
    assert failures == []
    gb = entries[0]
    assert gb["petpooja_id"] == "7765862"
    assert gb["price"] == 140
    assert gb["available"] is True
    assert gb["category"] == "Starters"
    assert gb["gst_liability"] == "vendor"
    assert gb["cgst_percentage"] == 2.5
    assert gb["sgst_percentage"] == 2.5
    chai = entries[1]
    assert chai["available"] is False


def test_parse_menu_wrapper_keys():
    for key in ("data", "menu", "items", "result"):
        entries, _ = petpooja.parse_menu({key: SAMPLE_RAW})
        assert len(entries) == 2


def test_parse_menu_skips_non_list_wrapper_values():
    entries, _ = petpooja.parse_menu({"data": "nope", "menu": SAMPLE_RAW})
    assert len(entries) == 2


def test_parse_menu_coercions():
    raw = [
        {"item_id": "5", "name": "X", "base_price": "99.5", "is_available": "1",
         "food_type": "nonveg", "cgst_percentage": "x", "sgst_percentage": "bad"},
        {"item_id": "6", "name": "Y", "base_price": 10, "food_type": "weird", "is_available": "no"},
        {"item_id": "9", "name": "V", "base_price": 20, "is_available": "maybe"},
        {"item_id": "7", "name": "Z", "base_price": ""},
        {"item_id": "8", "name": "W", "base_price": -5},
    ]
    entries, failures = petpooja.parse_menu(raw)
    x, y, v3 = entries
    assert x["price"] == 99.5
    assert x["available"] is True
    assert x["item_type"] == "non-veg"
    assert x["cgst_percentage"] is None
    assert x["sgst_percentage"] is None
    assert y["item_type"] == "mixed"
    assert y["available"] is False
    assert v3["available"] is True  # unrecognized string -> default
    assert {f["reason"] for f in failures} == {"Invalid price"}


def test_parse_menu_skips_bad_entries():
    raw = SAMPLE_RAW + [
        {"name": "No Id", "base_price": 10},          # missing petpooja_id
        {"item_id": "9", "base_price": 10},            # missing name
        {"item_id": "8", "name": "Bad Price", "base_price": "x"},  # invalid price
        "garbage-string",                              # not a dict
    ]
    entries, failures = petpooja.parse_menu(raw)
    assert len(entries) == 2
    reasons = {f["reason"] for f in failures}
    assert reasons == {"Missing petpooja_id", "Missing name", "Invalid price", "Invalid entry"}


def test_parse_menu_garbage_raises():
    with pytest.raises(PetpoojaApiError):
        petpooja.parse_menu({"nope": 1})
    with pytest.raises(PetpoojaApiError):
        petpooja.parse_menu("garbage")


def test_parse_menu_petpooja_contract_shape():
    """The observed fetchmenu shape: itemname/itemid/price + id-based joins."""
    raw = {
        "items": [
            {"itemid": "118829149", "itemname": "Veg Loaded Pizza", "price": "100",
             "active": "1", "in_stock": "2", "item_categoryid": "500773",
             "item_tax": "11213,20375"},
            {"itemid": "118807411", "itemname": "Chocolate cake", "price": "310",
             "active": "0", "item_categoryid": "500774", "item_tax": "21866"},
        ],
        "categories": [
            {"categoryid": "500773", "categoryname": "Pizzaandsides"},
            {"categoryid": "500774", "categoryname": "Cakes"},
        ],
        "taxes": [
            {"taxid": "11213", "taxname": "CGST", "tax": "2.5"},
            {"taxid": "20375", "taxname": "SGST", "tax": "2.5"},
            {"taxid": "21866", "taxname": "GST", "tax": "5"},
        ],
    }
    entries, failures = petpooja.parse_menu(raw)
    assert failures == []
    pizza, cake = entries
    assert pizza["petpooja_id"] == "118829149"
    assert pizza["name"] == "Veg Loaded Pizza"
    assert pizza["price"] == 100
    assert pizza["available"] is True   # active="1" beats ambiguous in_stock="2"
    assert cake["available"] is False   # active="0"
    assert pizza["category"] == "Pizzaandsides"  # via item_categoryid join
    assert pizza["cgst_percentage"] == 2.5       # via item_tax join
    assert pizza["sgst_percentage"] == 2.5
    assert cake["category"] == "Cakes"
    assert cake["cgst_percentage"] is None       # 'GST' matches neither cgst nor sgst
    assert cake["sgst_percentage"] is None


def test_parse_menu_direct_fields_beat_joins():
    raw = {
        "items": [{"itemid": "1", "itemname": "X", "price": 10,
                   "category": "Direct", "cgst_percentage": 9, "item_tax": "11213"}],
        "categories": [{"categoryid": "500773", "categoryname": "Joined"}],
        "taxes": [{"taxid": "11213", "taxname": "CGST", "tax": "2.5"}],
    }
    (entry,) = petpooja.parse_menu(raw)[0]
    assert entry["category"] == "Direct"
    assert entry["cgst_percentage"] == 9


# ------------------------------ sync_menu ------------------------------
def _items(db):
    return db.read("restaurants/r1/items") or {}


def test_sync_menu_first_sync_creates_structure(db):
    entries, _ = petpooja.parse_menu(SAMPLE_RAW)
    report = petpooja.sync_menu(db, "r1", entries)
    assert report["added"] == 2
    assert report["updated"] == 0
    assert report["failed"] == 0

    mains = db.read("restaurants/r1/main_categories") or {}
    main = next(v for v in mains.values() if v["name"] == "Petpooja Menu")

    subs = db.read("restaurants/r1/categories") or {}
    by_name = {v["name"]: v for v in subs.values()}
    assert set(by_name) == {"Starters", "Beverages"}
    for v in by_name.values():
        assert v["main_category_id"] in mains

    items = _items(db)
    gb = next(v for v in items.values() if v["name"] == "Garlic Bread")
    starters_id = next(cid for cid, v in subs.items() if v["name"] == "Starters")
    assert gb["price"] == 140
    assert gb["is_enabled"] is True
    assert gb["category_id"] == starters_id
    assert gb["main_category_id"] in mains
    assert gb["petpooja_mapping"]["petpooja_id"] == "7765862"
    assert gb["petpooja_mapping"]["gst_liability"] == "vendor"
    assert gb["taste"] == [] and gb["spice_level"] == 0  # schema defaults


def test_sync_menu_second_sync_updates_and_preserves_enrichment(db):
    petpooja.sync_menu(db, "r1", petpooja.parse_menu(SAMPLE_RAW)[0])

    # Owner enriches the item locally after the first sync.
    iid = next(iid for iid, v in _items(db).items() if v["name"] == "Garlic Bread")
    db.seed(f"restaurants/r1/items/{iid}/taste", ["cheesy"])
    db.seed(f"restaurants/r1/items/{iid}/image_url", "https://cdn/gb.jpg")
    db.seed(f"restaurants/r1/items/{iid}/recommendations", {"x": {"menu_item_id": "other"}})

    updated_raw = [{
        "item_id": "7765862", "name": "Garlic Bread Supreme", "base_price": 160,
        "is_available": False, "category": "Breads",
        "gst_liability": "vendor", "cgst_percentage": 2.5, "sgst_percentage": 2.5,
    }]
    report = petpooja.sync_menu(db, "r1", petpooja.parse_menu(updated_raw)[0])
    assert report["updated"] == 1
    assert report["added"] == 0

    item = db.read(f"restaurants/r1/items/{iid}")
    assert item["name"] == "Garlic Bread Supreme"
    assert item["price"] == 160
    assert item["is_enabled"] is False
    # enrichment preserved
    assert item["taste"] == ["cheesy"]
    assert item["image_url"] == "https://cdn/gb.jpg"
    assert item["recommendations"]["x"]["menu_item_id"] == "other"


def test_sync_menu_local_only_item_untouched(db):
    db.seed("restaurants/r1/items/keep", {"name": "Local Special", "price": 99, "taste": ["spicy"]})
    report = petpooja.sync_menu(db, "r1", petpooja.parse_menu(SAMPLE_RAW)[0])
    assert report["added"] == 2
    assert db.read("restaurants/r1/items/keep") == {"name": "Local Special", "price": 99, "taste": ["spicy"]}


def test_sync_menu_duplicate_name_recorded(db):
    db.seed("restaurants/r1/items/local", {"name": "garlic bread", "price": 5})  # no mapping, same name
    report = petpooja.sync_menu(db, "r1", petpooja.parse_menu(SAMPLE_RAW)[0])
    assert report["added"] == 1   # only Masala Chai
    assert report["failed"] == 1
    assert report["failures"][0]["reason"] == "Duplicate name"


def test_sync_menu_skips_degenerate_item_nodes(db):
    db.seed("restaurants/r1/items/empty", {})
    db.seed("restaurants/r1/items/nameless", {"price": 5})
    report = petpooja.sync_menu(db, "r1", petpooja.parse_menu(SAMPLE_RAW)[0])
    assert report["added"] == 2


def test_sync_menu_reuses_existing_petpooja_categories(db):
    db.seed("restaurants/r1/main_categories/m1", {"name": "Petpooja Menu", "display_order": 3})
    db.seed("restaurants/r1/main_categories/broken", {})
    db.seed("restaurants/r1/categories/c1", {"name": "Starters", "main_category_id": "m1"})  # no display_order
    db.seed("restaurants/r1/categories/other", {"name": "Elsewhere", "main_category_id": "m9"})
    db.seed("restaurants/r1/categories/noName", {"main_category_id": "m1"})
    petpooja.sync_menu(db, "r1", petpooja.parse_menu(SAMPLE_RAW)[0])
    subs = db.read("restaurants/r1/categories") or {}
    by_name = {}
    for v in subs.values():
        if v.get("name"):
            by_name.setdefault(v["name"], []).append(v)
    assert len(by_name["Starters"]) == 1  # reused, not duplicated
    assert by_name["Beverages"][0]["display_order"] == 1  # max order found was 0


def test_sync_menu_main_order_after_existing_mains(db):
    db.seed("restaurants/r1/main_categories/m1", {"name": "Food", "display_order": 2})
    petpooja.sync_menu(db, "r1", petpooja.parse_menu(SAMPLE_RAW)[0])
    mains = db.read("restaurants/r1/main_categories") or {}
    pp = next(v for v in mains.values() if v["name"] == "Petpooja Menu")
    assert pp["display_order"] == 3


def test_sync_menu_rerun_is_idempotent_upsert(db):
    petpooja.sync_menu(db, "r1", petpooja.parse_menu(SAMPLE_RAW)[0])
    report = petpooja.sync_menu(db, "r1", petpooja.parse_menu(SAMPLE_RAW)[0])
    assert report["added"] == 0
    assert report["updated"] == 2
    assert report["failed"] == 0
    subs = db.read("restaurants/r1/categories") or {}
    assert len(subs) == 2  # no duplicate sub-categories


def test_sync_menu_defaults_missing_category(db):
    entries, _ = petpooja.parse_menu([{"item_id": "1", "name": "Solo", "base_price": 10}])
    petpooja.sync_menu(db, "r1", entries)
    subs = db.read("restaurants/r1/categories") or {}
    assert list(subs.values())[0]["name"] == "Uncategorized"


# --------------------------- map_order_payload ------------------------
def test_map_order_payload_dinein():
    order = {
        "table_number": "7",
        "user_name": "Sam",
        "total_amount": 165,
        "items": [
            {"id": "i1", "name": "Garlic Bread", "price": 140, "quantity": 1},
            {"id": None, "name": "Chef Special", "price": 25, "quantity": 1},
        ],
    }
    mappings = {"i1": {"petpooja_id": "7765862", "gst_liability": "vendor",
                       "cgst_percentage": 2.5, "sgst_percentage": 2.5}}
    payload = petpooja.map_order_payload(order, mappings, FULL_CREDS)
    assert payload["restID"] == "R99"
    assert payload["order_type"] == "dinein"
    assert payload["table_number"] == "7"
    assert payload["table_id"] is None  # no table mapping -> not guessed
    assert payload["items"][0]["petpooja_id"] == "7765862"
    assert payload["items"][0]["cgst_percentage"] == 2.5
    assert payload["items"][1]["petpooja_id"] is None  # unmapped, not dropped


def test_map_order_payload_with_table_mapping_sends_petpooja_table_id():
    order = {"table_number": "7", "items": [], "total_amount": 0}
    table_mapping = {"petpooja_table_id": "TBL-42"}
    payload = petpooja.map_order_payload(order, {}, FULL_CREDS, table_mapping)
    assert payload["table_id"] == "TBL-42"
    assert payload["table_number"] == "7"  # kept for readability/debugging


def test_map_order_payload_empty_table_mapping_is_none():
    order = {"table_number": "7", "items": [], "total_amount": 0}
    payload = petpooja.map_order_payload(order, {}, FULL_CREDS, {"petpooja_table_id": ""})
    assert payload["table_id"] is None


def test_map_order_payload_skips_non_dict_items():
    payload = petpooja.map_order_payload(
        {"items": ["junk", {"id": "i1", "name": "A", "price": 1, "quantity": 1}], "table_number": "1"},
        {"i1": {"petpooja_id": "9"}},
        {},
    )
    assert len(payload["items"]) == 1
    assert payload["restID"] == ""


# --------------------------- pos_adapters -----------------------------
def test_get_pos_integration_defaults(db):
    from pos_adapters import get_pos_integration
    db.seed("restaurants/r1/pos_integration", {"credentials": {"restID": "x"}})
    assert get_pos_integration(db, "r1") == ("native", {"restID": "x"})
    db.seed("restaurants/r2/pos_integration", {"provider": "petpooja", "credentials": FULL_CREDS})
    provider, creds = get_pos_integration(db, "r2")
    assert provider == "petpooja"
    assert creds == FULL_CREDS


def test_resolve_item_mappings_handles_unknown_and_unmapped(db):
    from pos_adapters import _resolve_item_mappings
    db.seed("restaurants/r1/items/i1", {"name": "A"})
    db.seed("restaurants/r1/items/i2", {"name": "B", "petpooja_mapping": {"petpooja_id": "7"}})
    mappings = _resolve_item_mappings(db, "r1", [
        {"id": "ghost"}, {"id": "i1"}, {"id": "i2"}, {"name": "no id"}
    ])
    assert mappings == {"i2": {"petpooja_id": "7"}}


# ------------------------- /admin/menu/fetch-pos ----------------------
def test_fetch_pos_no_provider_configured(client, db, auth_headers):
    resp = client.post("/api/admin/menu/fetch-pos", headers=auth_headers)
    assert resp.status_code == 400
    assert "No POS configured" in resp.get_json()["error"]


def test_fetch_pos_incomplete_credentials(client, db, auth_headers):
    db.seed("restaurants/r1/pos_integration", {
        "provider": "petpooja",
        "credentials": {"app_key": "k", "app_secret": "", "access_token": "", "restID": ""},
    })
    resp = client.post("/api/admin/menu/fetch-pos", headers=auth_headers)
    assert resp.status_code == 400
    assert "incomplete" in resp.get_json()["error"]


def test_fetch_pos_api_error_is_502(client, db, auth_headers, monkeypatch):
    _seed_petpooja_r1(db)
    def _boom(credentials):
        raise PetpoojaApiError("Petpooja returned HTTP 500.")
    monkeypatch.setattr(petpooja, "fetch_menu", _boom)
    resp = client.post("/api/admin/menu/fetch-pos", headers=auth_headers)
    assert resp.status_code == 502
    assert "HTTP 500" in resp.get_json()["error"]


def test_fetch_pos_success_reports_and_persists(client, db, auth_headers, monkeypatch):
    _seed_petpooja_r1(db)
    raw = SAMPLE_RAW + [{"name": "No Id", "base_price": 10}]  # one unparseable entry
    monkeypatch.setattr(petpooja, "fetch_menu", lambda credentials: raw)
    resp = client.post("/api/admin/menu/fetch-pos", headers=auth_headers)
    assert resp.status_code == 200
    report = resp.get_json()
    assert report["added"] == 2
    assert report["failed"] == 1  # parse failure merged into the report
    assert report["total"] == 3
    assert report["failures"][0]["reason"] == "Missing petpooja_id"
    items = _items(db)
    assert any(v["petpooja_mapping"]["petpooja_id"] == "7765862" for v in items.values())


# ------------------------------ fetch_tables ---------------------------
def test_fetch_tables_posts_to_gettableinfo(monkeypatch):
    captured = {}
    _stub_requests(monkeypatch, response=_StubResponse(payload={"data": []}), captured=captured)
    raw = petpooja.fetch_tables(FULL_CREDS)
    assert raw == {"data": []}
    assert captured["url"].endswith("/gettableinfo")
    assert captured["json"] == {"AppKey": "k", "AppSecret": "s", "AccessToken": "t", "restID": "R99"}


SAMPLE_TABLES_RAW = [
    {"table_id": "881", "table_name": "T1", "no_of_chairs": 4},
    {"tableid": "882", "tablename": "T2"},
]


def test_parse_tables_shapes_and_fallbacks():
    entries, failures = petpooja.parse_tables(SAMPLE_TABLES_RAW)
    assert failures == []
    assert entries == [
        {"petpooja_table_id": "881", "table_number": "T1"},
        {"petpooja_table_id": "882", "table_number": "T2"},
    ]
    # name missing -> fall back to the id as the display number
    entries, _ = petpooja.parse_tables([{"table_id": "9"}])
    assert entries[0]["table_number"] == "9"
    # wrapper keys
    for key in ("data", "tables", "tableinfo", "result"):
        entries, _ = petpooja.parse_tables({key: SAMPLE_TABLES_RAW})
        assert len(entries) == 2


def test_parse_tables_skips_bad_entries():
    entries, failures = petpooja.parse_tables(
        SAMPLE_TABLES_RAW + [{"table_name": "No Id"}, "junk"]
    )
    assert len(entries) == 2
    reasons = {f["reason"] for f in failures}
    assert reasons == {"Missing petpooja_table_id", "Invalid entry"}


def test_parse_tables_garbage_raises():
    with pytest.raises(PetpoojaApiError):
        petpooja.parse_tables({"nope": 1})


# ------------------------------ sync_tables ----------------------------
def _tables(db):
    return db.read("restaurants/r1/tables") or {}


def test_sync_tables_first_sync_creates_tables_with_tokens(db):
    entries, _ = petpooja.parse_tables(SAMPLE_TABLES_RAW)
    report = petpooja.sync_tables(db, "r1", entries)
    assert report == {"added": 2, "updated": 0, "failed": 0, "total": 2,
                      "added_names": ["T1", "T2"], "failures": []}

    tables = _tables(db)
    assert len(tables) == 2
    t1 = next(v for v in tables.values() if v["table_number"] == "T1")
    assert t1["petpooja_mapping"]["petpooja_table_id"] == "881"
    assert t1["qr_token"]
    lookup = db.read(f"table_tokens/{t1['qr_token']}")
    assert lookup == {"restaurant_id": "r1", "table_number": "T1",
                      "table_id": next(k for k, v in tables.items() if v is t1)}


def test_sync_tables_links_existing_table_by_number_keeping_qr(db):
    db.seed("restaurants/r1/tables/local1", {"table_number": "T1", "qr_token": "keep-me"})
    db.seed("table_tokens/keep-me", {"restaurant_id": "r1", "table_number": "T1",
                                     "table_id": "local1"})
    entries, _ = petpooja.parse_tables(SAMPLE_TABLES_RAW)
    report = petpooja.sync_tables(db, "r1", entries)
    assert report["added"] == 1  # only T2
    assert report["updated"] == 1  # T1 linked in place

    t1 = db.read("restaurants/r1/tables/local1")
    assert t1["qr_token"] == "keep-me"  # QR codes stay valid
    assert t1["petpooja_mapping"]["petpooja_table_id"] == "881"
    assert db.read("table_tokens/keep-me")["table_id"] == "local1"


def test_sync_tables_rerun_is_idempotent_upsert(db):
    entries, _ = petpooja.parse_tables(SAMPLE_TABLES_RAW)
    petpooja.sync_tables(db, "r1", entries)
    report = petpooja.sync_tables(db, "r1", entries)
    assert report["added"] == 0
    assert report["updated"] == 2
    assert len(_tables(db)) == 2


def test_sync_tables_duplicate_number_recorded(db):
    raw = [{"table_id": "1", "table_name": "T1"}, {"table_id": "2", "table_name": "t1 "}]
    report = petpooja.sync_tables(db, "r1", petpooja.parse_tables(raw)[0])
    assert report["added"] == 1
    assert report["failed"] == 1
    assert report["failures"][0]["reason"] == "Duplicate table number"


def test_sync_tables_skips_degenerate_nodes_and_heals_missing_token(db):
    db.seed("restaurants/r1/tables/empty", {})
    db.seed("restaurants/r1/tables/notoken", {
        "table_number": "T1",
        "petpooja_mapping": {"petpooja_table_id": "881"},
    })
    report = petpooja.sync_tables(db, "r1", petpooja.parse_tables(SAMPLE_TABLES_RAW)[0])
    assert report["updated"] == 1  # T1 matched by pid despite the missing token
    assert report["added"] == 1    # T2
    healed = db.read("restaurants/r1/tables/notoken")
    assert healed["qr_token"]
    assert db.read(f"table_tokens/{healed['qr_token']}")["table_id"] == "notoken"


# --------------------------- _resolve_table_mapping -------------------
def test_resolve_table_mapping_by_number(db):
    from pos_adapters import _resolve_table_mapping
    db.seed("restaurants/r1/tables/t1", {"table_number": "7"})
    db.seed("restaurants/r1/tables/t7", {"table_number": "7", "qr_token": "x",
                                         "petpooja_mapping": {"petpooja_table_id": "881"}})
    assert _resolve_table_mapping(db, "r1", 7) == {"petpooja_table_id": "881"}
    assert _resolve_table_mapping(db, "r1", "99") is None
    assert _resolve_table_mapping(db, "r1", None) is None


# ------------------------- /admin/tables/fetch-pos --------------------
def test_fetch_tables_pos_no_provider_configured(client, db, auth_headers):
    resp = client.post("/api/admin/tables/fetch-pos", headers=auth_headers)
    assert resp.status_code == 400
    assert "No POS configured" in resp.get_json()["error"]


def test_fetch_tables_pos_incomplete_credentials(client, db, auth_headers):
    _seed_petpooja_r1(db)
    db.seed("restaurants/r1/pos_integration", {
        "provider": "petpooja",
        "credentials": {"app_key": "k", "app_secret": "", "access_token": "", "restID": ""},
    })
    resp = client.post("/api/admin/tables/fetch-pos", headers=auth_headers)
    assert resp.status_code == 400
    assert "incomplete" in resp.get_json()["error"]


def test_fetch_tables_pos_api_error_is_502(client, db, auth_headers, monkeypatch):
    _seed_petpooja_r1(db)
    def _boom(credentials):
        raise PetpoojaApiError("Petpooja returned HTTP 500.")
    monkeypatch.setattr(petpooja, "fetch_tables", _boom)
    resp = client.post("/api/admin/tables/fetch-pos", headers=auth_headers)
    assert resp.status_code == 502
    assert "HTTP 500" in resp.get_json()["error"]


def test_fetch_tables_pos_success_persists_and_reports(client, db, auth_headers, monkeypatch):
    _seed_petpooja_r1(db)
    raw = SAMPLE_TABLES_RAW + [{"table_name": "No Id"}]
    monkeypatch.setattr(petpooja, "fetch_tables", lambda credentials: raw)
    resp = client.post("/api/admin/tables/fetch-pos", headers=auth_headers)
    assert resp.status_code == 200
    report = resp.get_json()
    assert report["added"] == 2
    assert report["failed"] == 1
    assert report["failures"][0]["reason"] == "Missing petpooja_table_id"
    tables = _tables(db)
    assert any(v["petpooja_mapping"]["petpooja_table_id"] == "881" for v in tables.values())
