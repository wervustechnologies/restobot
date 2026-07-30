import time
from datetime import datetime, timedelta


def _now_ts():
    return datetime.utcnow().timestamp()


def _order(db, oid, status, total, created_at=None, billed_at=None, items=None):
    db.seed(f"restaurants/r1/orders/{oid}", {
        "status": status,
        "total_amount": total,
        "created_at": created_at if created_at is not None else _now_ts(),
        "billed_at": billed_at,
        "items": items if items is not None else [],
    })


def test_analytics_no_date_range_default_window(client, db, auth_headers):
    _order(db, "o1", "completed", total=100, items=[{"name": "Burger", "quantity": 2}])
    _order(db, "o2", "pending", total=10)
    _order(db, "o3", "claimed", total=5)
    _order(db, "o4", "completed", total=50, items=[{"name": "Fries", "quantity": 1}])
    _order(db, "o5", "billed", total=30, billed_at=_now_ts())
    db.seed("restaurants/r1/tables", {"t1": {"table_number": "1"}, "t2": {"table_number": "2"}})

    resp = client.get("/api/admin/analytics", headers=auth_headers)
    assert resp.status_code == 200
    m = resp.get_json()
    assert m["total_revenue"] == 150          # completed only
    assert m["total_orders"] == 5
    assert m["pending_orders"] == 2           # pending + claimed
    assert m["completed_orders"] == 2
    assert m["avg_order_value"] == round(150 / 2, 2)
    assert m["total_tables"] == 2
    assert len(m["daily_revenue"]) == 7       # default 7-day window
    assert m["billed_orders"] == 1
    assert m["billed_revenue"] == 30
    assert m["billed_avg_order_value"] == 30.0
    # popular items aggregated by name -> quantity, top 5
    assert m["popular_items"][0] == {"name": "Burger", "orders": 2}


def test_analytics_avg_zero_when_no_completed(client, db, auth_headers):
    _order(db, "o1", "pending", total=10)
    m = client.get("/api/admin/analytics", headers=auth_headers).get_json()
    assert m["total_revenue"] == 0
    assert m["avg_order_value"] == 0
    assert m["billed_avg_order_value"] == 0
    assert m["popular_items"] == []


def test_analytics_billed_falls_back_to_created_at(client, db, auth_headers):
    # billed order without billed_at should still be counted via created_at fallback
    _order(db, "o1", "billed", total=40, billed_at=None)
    m = client.get("/api/admin/analytics", headers=auth_headers).get_json()
    assert m["billed_revenue"] == 40
    assert m["billed_orders"] == 1


def test_analytics_with_date_range(client, db, auth_headers):
    today = datetime.utcnow().date()
    in_range_ts = datetime.combine(today, datetime.min.time()).timestamp() + 3600
    out_of_range_ts = (datetime.combine(today, datetime.min.time()) - timedelta(days=10)).timestamp()
    _order(db, "o_in", "completed", total=80, created_at=in_range_ts)
    _order(db, "o_out", "completed", total=999, created_at=out_of_range_ts)

    start = (today - timedelta(days=2)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")
    resp = client.get(f"/api/admin/analytics?start_date={start}&end_date={end}", headers=auth_headers)
    assert resp.status_code == 200
    m = resp.get_json()
    # only the in-range order counted; window length = 3 days
    assert m["total_orders"] == 1
    assert m["total_revenue"] == 80
    assert len(m["daily_revenue"]) == 3


def test_analytics_popular_items_capped_at_five(client, db, auth_headers):
    for i in range(7):
        _order(db, f"o{i}", "completed", total=1, items=[{"name": f"I{i}", "quantity": 1}])
    m = client.get("/api/admin/analytics", headers=auth_headers).get_json()
    assert len(m["popular_items"]) == 5


def test_analytics_unknown_item_name(client, db, auth_headers):
    _order(db, "o1", "completed", total=10, items=[{"quantity": 1}])  # no name
    m = client.get("/api/admin/analytics", headers=auth_headers).get_json()
    assert m["popular_items"][0]["name"] == "Unknown"


def test_analytics_no_orders(client, db, auth_headers):
    db.seed("restaurants/r1", {"name": "R"})  # ensure restaurant exists
    m = client.get("/api/admin/analytics", headers=auth_headers).get_json()
    assert m["total_orders"] == 0
    assert m["total_revenue"] == 0
    assert m["total_tables"] == 0
    assert m["popular_items"] == []


def test_analytics_parse_date_defensive_branches(client, db, auth_headers):
    # created_at falsy -> parse_order_date returns None (excluded from daily)
    _order(db, "o_zero", "completed", total=7, created_at=0)
    # created_at invalid type -> fromtimestamp raises -> except returns None
    _order(db, "o_bad", "completed", total=8, created_at="not-a-ts")
    # billed with no usable date -> billed_at & created_at both falsy -> None
    _order(db, "o_bill_none", "billed", total=11, billed_at=0, created_at=0)
    # billed with invalid billed_at type -> except returns None
    _order(db, "o_bill_bad", "billed", total=13, billed_at="bad")
    m = client.get("/api/admin/analytics", headers=auth_headers).get_json()
    # totals still aggregate; daily buckets for these are 0 (parse -> None)
    assert m["total_revenue"] == 15
    assert m["billed_revenue"] == 24
    assert all(d["amount"] == 0 for d in m["daily_revenue"])
