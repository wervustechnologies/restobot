from flask import Blueprint, jsonify, request
import time
from firebase_client import get_db
from auth_utils import token_required
from limiter import limiter, LIMIT_PUBLIC_WRITE

feedback_bp = Blueprint('feedback', __name__)

def format_list(data_dict):
    if not data_dict: return []
    return [{'id': k, **v} for k, v in data_dict.items()]

@feedback_bp.route('/feedback', methods=['POST'])
@limiter.limit(LIMIT_PUBLIC_WRITE)
def submit_feedback():
    db_ref = get_db()
    data = request.get_json()

    restaurant_id = data.get('restaurant_id')
    rating = data.get('rating')
    description = data.get('description', '')
    guest_id = data.get('guest_id', '')

    if not restaurant_id:
        return jsonify({'error': 'Missing restaurant_id'}), 400
    if not rating or not isinstance(rating, int) or rating < 1 or rating > 5:
        return jsonify({'error': 'Rating must be an integer between 1 and 5'}), 400

    feedback_data = {
        'rating': rating,
        'description': description,
        'guest_id': guest_id,
        'created_at': time.time()
    }

    db_ref.child(f'restaurants/{restaurant_id}/feedback').push(feedback_data)

    return jsonify({'success': True, 'message': 'Feedback submitted'}), 201

@feedback_bp.route('/admin/feedback', methods=['GET'])
@token_required
def get_feedback():
    db_ref = get_db()
    restaurant_id = request.restaurant_id

    feedback = db_ref.child(f'restaurants/{restaurant_id}/feedback').get()
    feedback_list = format_list(feedback)
    feedback_list.sort(key=lambda x: x.get('created_at', 0), reverse=True)

    return jsonify(feedback_list), 200
