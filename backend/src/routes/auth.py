from flask import Blueprint, jsonify, request

from src.services import auth

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.post("/signup")
def signup():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}
    try:
        user_id = auth.signup(data.get("email"), data.get("password"))
    except auth.ValidationError as e:
        return jsonify({"error": e.message}), 400
    except auth.DuplicateEmailError:
        return jsonify({"error": "Email already registered"}), 409
    return jsonify({"id": user_id}), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}
    try:
        token = auth.login(data.get("email"), data.get("password"))
    except auth.InvalidCredentialsError:
        return jsonify({"error": "Invalid email or password"}), 401
    return jsonify({"token": token}), 200
