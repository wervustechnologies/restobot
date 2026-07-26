from flask import Blueprint, jsonify, request
import time
from firebase_client import get_db
from limiter import limiter, LIMIT_PUBLIC_WRITE

guests_bp = Blueprint('guests', __name__)

def format_list(data_dict):
    if not data_dict: return []
    return [{'id': k, **v} for k, v in data_dict.items()]

@guests_bp.route('/guests/identify', methods=['POST'])
@limiter.limit(LIMIT_PUBLIC_WRITE)
def identify_guest():
    db_ref = get_db()
    data = request.get_json()
    
    fingerprint = data.get('fingerprint')
    if not fingerprint:
        return jsonify({'error': 'Missing fingerprint'}), 400
    
    # Index on guests/fingerprint scopes the read server-side instead of
    # loading the global guests collection and scanning in Python.
    guests_dict = db_ref.child('guests').order_by_child('fingerprint').equal_to(fingerprint).get()
    guests = format_list(guests_dict)

    guest = guests[0] if guests else None
    
    now = time.time()
    
    if guest:
        guest_id = guest['id']
        visit_count = guest.get('visit_count', 0)
        points = guest.get('points', 0)
        last_visit = guest.get('last_visit', 0)
        
        # Only increment visit count if last visit was more than 1 hour ago (to prevent spam refresh points)
        if now - last_visit > 3600:
            visit_count += 1
            # Award points on 5th visit
            if visit_count == 5:
                points += 5
            
            db_ref.child(f'guests/{guest_id}').update({
                'visit_count': visit_count,
                'points': points,
                'last_visit': now
            })
    else:
        # Create new guest
        guest_data = {
            'fingerprint': fingerprint,
            'visit_count': 1,
            'points': 0,
            'last_visit': now,
            'created_at': now
        }
        new_guest_ref = db_ref.child('guests').push(guest_data)
        guest_id = new_guest_ref.key
        points = 0
        visit_count = 1
    
    return jsonify({
        'success': True, 
        'guest_id': guest_id, 
        'points': points, 
        'visit_count': visit_count
    }), 200
