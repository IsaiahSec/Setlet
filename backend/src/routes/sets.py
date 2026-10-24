from flask import Blueprint, g, jsonify, request

from src.models import cards
from src.models import study_sets
from src.routes.decorators import require_auth
from src.services import cards as cards_service
from src.services import study_sets as study_sets_service

sets_bp = Blueprint("sets", __name__, url_prefix="/sets")


@sets_bp.post("")
@require_auth
def create_set():
    data = request.get_json(silent=True)
    try:
        result = study_sets_service.create_set(g.user_id, data)
    except study_sets_service.ValidationError as error:
        return jsonify({"error": error.message}), 400
    return jsonify(result), 201


@sets_bp.get("")
@require_auth
def list_sets():
    return jsonify({"sets": study_sets.list_sets(g.user_id)}), 200


@sets_bp.get("/public")
@require_auth
def list_public_sets():
    try:
        result = study_sets_service.list_public_sets(
            g.user_id,
            request.args.get("q"),
            request.args.get("page"),
            request.args.get("page_size"),
        )
    except study_sets_service.ValidationError as error:
        return jsonify({"error": error.message}), 400
    return jsonify(result), 200


@sets_bp.get("/<int:set_id>")
@require_auth
def get_set(set_id):
    result = study_sets.get_set_for_viewer(set_id, g.user_id)
    if result is None:
        return jsonify({"error": "Set not found"}), 404
    result["is_owner"] = result["owner_id"] == g.user_id
    return jsonify(result), 200


@sets_bp.patch("/<int:set_id>")
@require_auth
def update_set(set_id):
    data = request.get_json(silent=True)
    try:
        result = study_sets_service.update_set(g.user_id, set_id, data)
    except study_sets_service.ValidationError as error:
        return jsonify({"error": error.message}), 400
    if result is None:
        return jsonify({"error": "Set not found"}), 404
    return jsonify(result), 200


@sets_bp.delete("/<int:set_id>")
@require_auth
def delete_set(set_id):
    if not study_sets.delete_set(g.user_id, set_id):
        return jsonify({"error": "Set not found"}), 404
    return "", 204


@sets_bp.post("/<int:set_id>/cards")
@require_auth
def create_card(set_id):
    data = request.get_json(silent=True)
    try:
        result = cards_service.create_card(g.user_id, set_id, data)
    except cards_service.ValidationError as error:
        return jsonify({"error": error.message}), 400
    if result is None:
        return jsonify({"error": "Not found"}), 404
    return jsonify(result), 201


@sets_bp.patch("/<int:set_id>/cards/<int:card_id>")
@require_auth
def update_card(set_id, card_id):
    data = request.get_json(silent=True)
    try:
        result = cards_service.update_card(g.user_id, set_id, card_id, data)
    except cards_service.ValidationError as error:
        return jsonify({"error": error.message}), 400
    if result is None:
        return jsonify({"error": "Not found"}), 404
    return jsonify(result), 200


@sets_bp.delete("/<int:set_id>/cards/<int:card_id>")
@require_auth
def delete_card(set_id, card_id):
    if not cards.delete_card(g.user_id, set_id, card_id):
        return jsonify({"error": "Not found"}), 404
    return "", 204
