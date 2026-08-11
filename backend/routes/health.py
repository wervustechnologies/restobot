import time
from datetime import datetime, timezone

from flask import Blueprint, jsonify

from firebase_client import get_db

health_bp = Blueprint('health', __name__)

_started_at = time.time()


@health_bp.route('/health', methods=['GET'])
def health():
    uptime_seconds = round(time.time() - _started_at, 3)

    db_status = 'ok'
    try:
        get_db().child('.info/connected').get()
    except Exception as exc:
        db_status = f'error: {exc}'

    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'uptime_seconds': uptime_seconds,
        'database': db_status,
    }), 200
