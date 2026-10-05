import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from src.db import init_db
from src.routes.auth import auth_bp

load_dotenv()


def create_app():
    app = Flask(__name__)
    CORS(
        app,
        resources={r"/*": {"origins": os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")}},
        allow_headers=["Authorization", "Content-Type"],
    )

    app.register_blueprint(auth_bp)

    if os.environ.get("DATABASE_URL"):
        init_db()

    @app.route("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
