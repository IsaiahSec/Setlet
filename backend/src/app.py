from flask import Flask


def create_app():
    app = Flask(__name__)

    # Blueprints will be registered here as routes are built out, e.g.:
    # from src.routes.auth import auth_bp
    # app.register_blueprint(auth_bp)

    @app.route("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
