from flask import Flask
from flask_cors import CORS
import os
from firebase_client import init_firebase

def create_app():
    app = Flask(__name__)
    
    # Initialize Firebase
    init_firebase()

    # CORS: allow origins from environment or known defaults
    frontend_url = os.environ.get('FRONTEND_URL', '')
    allowed_origins = [o.strip() for o in frontend_url.split(',') if o.strip()] if frontend_url else []
    
    # Add known frontend URLs as fallbacks
    known_origins = [
        "https://restobot-zeta.vercel.app",
        "http://localhost:5173",
        "http://localhost:5174",
    ]
    for origin in known_origins:
        if origin not in allowed_origins:
            allowed_origins.append(origin)
    
    CORS(app, resources={r"/*": {
        "origins": allowed_origins,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
        "supports_credentials": True
    }})

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

    return app
