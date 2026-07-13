from flask import Blueprint, jsonify, request
from firebase_client import get_db
from auth_utils import token_required
from datetime import datetime, timedelta

analytics_bp = Blueprint('analytics', __name__)

def format_list(data_dict):
    if not data_dict: return []
    return [{'id': k, **v} for k, v in data_dict.items()]

@analytics_bp.route('/admin/analytics', methods=['GET'])
@token_required
def get_analytics():
    db_ref = get_db()
    res_id = request.restaurant_id
    
    orders_dict = db_ref.child(f'restaurants/{res_id}/orders').get()
    orders = format_list(orders_dict)
    
    completed_orders = [o for o in orders if o.get('status') == 'completed']
    pending_orders = [o for o in orders if o.get('status') in ('pending', 'claimed')]
    
    total_revenue = sum(o.get('total_amount', 0) for o in completed_orders)
    total_orders = len(orders)
    
    # Daily revenue (completed orders only)
    now = datetime.utcnow()
    daily_revenue = []
    for i in range(6, -1, -1):
        date = (now - timedelta(days=i)).strftime('%Y-%m-%d')
        day_total = sum(o.get('total_amount', 0) for o in completed_orders if o.get('created_at') and datetime.fromtimestamp(o['created_at']).strftime('%Y-%m-%d') == date)
        daily_revenue.append({'date': date, 'amount': day_total})

    # Popular items (from all orders)
    item_counts = {}
    for o in orders:
        for item in o.get('items', []):
            name = item.get('name', 'Unknown')
            item_counts[name] = item_counts.get(name, 0) + item.get('quantity', 1)
    
    popular_items = sorted([{'name': k, 'orders': v} for k, v in item_counts.items()], key=lambda x: x['orders'], reverse=True)[:5]

    # Total Tables
    tables_dict = db_ref.child(f'restaurants/{res_id}/tables').get()
    total_tables = len(tables_dict) if tables_dict else 0
    
    metrics = {
        'total_revenue': total_revenue,
        'total_orders': total_orders,
        'pending_orders': len(pending_orders),
        'completed_orders': len(completed_orders),
        'avg_order_value': round(total_revenue / len(completed_orders), 2) if completed_orders else 0,
        'daily_revenue': daily_revenue,
        'popular_items': popular_items,
        'total_tables': total_tables
    }
    
    return jsonify(metrics), 200
