from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from firebase_client import init_firebase

def create_app():
    app = Flask(__name__)
    
    init_firebase()

    frontend_url = os.environ.get('FRONTEND_URL', '')
    allowed_origins = [o.strip() for o in frontend_url.split(',') if o.strip()] if frontend_url else []
    
    known_origins = [
        "https://restobot-zeta.vercel.app",
        "http://localhost:5173",
        "http://localhost:5174",
    ]
    for origin in known_origins:
        if origin not in allowed_origins:
            allowed_origins.append(origin)

    CORS(app, resources={r"/api/*": {
        "origins": allowed_origins,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
        "supports_credentials": True
    }})

    @app.before_request
    def handle_preflight():
        if request.method == 'OPTIONS':
            origin = request.headers.get('Origin', '')
            if origin in allowed_origins:
                resp = app.make_default_options_response()
                resp.headers['Access-Control-Allow-Origin'] = origin
                resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept'
                resp.headers['Access-Control-Allow-Credentials'] = 'true'
                resp.headers['Access-Control-Max-Age'] = '3600'
                return resp

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get('Origin', '')
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response

    from routes.auth import auth_bp
    from routes.admin import admin_bp
    from routes.menu import menu_bp
    from routes.tables import tables_bp
    from routes.analytics import analytics_bp
    from routes.chat import chat_bp
    from routes.superadmin import superadmin_bp
    from routes.wishlist import wishlist_bp
    from routes.guests import guests_bp
    from routes.orders import orders_bp

    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(menu_bp, url_prefix='/api')
    app.register_blueprint(tables_bp, url_prefix='/api')
    app.register_blueprint(analytics_bp, url_prefix='/api')
    app.register_blueprint(chat_bp, url_prefix='/api')
    app.register_blueprint(superadmin_bp, url_prefix='/api')
    app.register_blueprint(wishlist_bp, url_prefix='/api')
    app.register_blueprint(guests_bp, url_prefix='/api')
    app.register_blueprint(orders_bp, url_prefix='/api')

    return app
