import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from src.db import init_db
from src.routes.auth import auth_bp
from src.routes.reviews import reviews_bp
from src.routes.sets import sets_bp

load_dotenv()


def create_app(initialize_database=True):
    app = Flask(__name__)
    CORS(
        app,
        resources={r"/*": {"origins": os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")}},
        allow_headers=["Authorization", "Content-Type"],
    )

    app.register_blueprint(auth_bp)
    app.register_blueprint(sets_bp)
    app.register_blueprint(reviews_bp)

    if initialize_database and os.environ.get("DATABASE_URL"):
        init_db()

    @app.route("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
