from functools import wraps

from flask import g, jsonify, request

from src.models import users
from src.services import auth


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        credentials = request.headers.get("Authorization", "").split()
        if len(credentials) != 2 or credentials[0].lower() != "bearer":
            return jsonify({"error": "Authentication required"}), 401

        user_id = auth.verify_token(credentials[1])
        if user_id is None or users.get_user_by_id(user_id) is None:
            return jsonify({"error": "Authentication required"}), 401

        g.user_id = user_id
        return view(*args, **kwargs)

    return wrapped
