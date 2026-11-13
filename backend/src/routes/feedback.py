from flask import Blueprint, g, jsonify, request

from src.routes.decorators import require_auth
from src.services import feedback as feedback_service

feedback_bp = Blueprint("feedback", __name__)


@feedback_bp.post("/feedback")
@require_auth
def submit_feedback():
    data = request.get_json(silent=True)
    message = data.get("message") if isinstance(data, dict) else None
    try:
        feedback_service.submit_feedback(g.user_id, message)
    except feedback_service.ValidationError as error:
        return jsonify({"error": error.message}), 400
    except feedback_service.RateLimitedError as error:
        return jsonify({"error": error.message}), 429
    except feedback_service.DeliveryError as error:
        return jsonify({"error": error.message}), 502

    return jsonify({"message": "Thanks for your feedback"}), 201
