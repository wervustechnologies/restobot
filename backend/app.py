from flask import Flask
from flask_cors import CORS
import os
from firebase_client import init_firebase

def create_app():
    app = Flask(__name__)
    
    # Initialize Firebase
    init_firebase()

    # Register blueprints
    from routes.auth import auth_bp
    from routes.admin import admin_bp
    from routes.menu import menu_bp
    from routes.tables import tables_bp
    from routes.analytics import analytics_bp
    from routes.chat import chat_bp
    from routes.superadmin import superadmin_bp
    from routes.wishlist import wishlist_bp
    from routes.guests import guests_bp

    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(menu_bp, url_prefix='/api')
    app.register_blueprint(tables_bp, url_prefix='/api')
    app.register_blueprint(analytics_bp, url_prefix='/api')
    app.register_blueprint(chat_bp, url_prefix='/api')
    app.register_blueprint(superadmin_bp, url_prefix='/api')
    app.register_blueprint(wishlist_bp, url_prefix='/api')
    app.register_blueprint(guests_bp, url_prefix='/api')

    # CORS: allow Vercel frontend + local dev
    # Set FRONTEND_URL env var on Render to your Vercel URL, e.g. https://restobot.vercel.app
    frontend_url = os.environ.get('FRONTEND_URL', '*')
    allowed_origins = [frontend_url] if frontend_url != '*' else '*'

    CORS(app,
         resources={r"/api/*": {"origins": allowed_origins}},
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])

    return app
