from flask import Blueprint, g, jsonify, request

from src.models import reviews
from src.models import study_sets
from src.routes.decorators import require_auth
from src.services import review as review_service

reviews_bp = Blueprint("reviews", __name__)


@reviews_bp.get("/sets/<int:set_id>/study")
@require_auth
def study_set(set_id):
    study_set = study_sets.get_set_for_viewer(set_id, g.user_id)
    if study_set is None:
        return jsonify({"error": "Set not found"}), 404

    now = review_service.utcnow()
    cards, counts = reviews.get_study_data(set_id, g.user_id, now)

    return jsonify(
        {
            "set": {"id": study_set["id"], "title": study_set["title"]},
            "cards": cards,
            "counts": counts,
        }
    ), 200


@reviews_bp.post("/cards/<int:card_id>/review")
@require_auth
def submit_review(card_id):
    data = request.get_json(silent=True)
    rating = data.get("rating") if isinstance(data, dict) else None
    try:
        result = review_service.submit_review(g.user_id, card_id, rating)
    except review_service.ValidationError as error:
        return jsonify({"error": error.message}), 400

    if result is None:
        return jsonify({"error": "Set not found"}), 404
    return jsonify(result), 200
