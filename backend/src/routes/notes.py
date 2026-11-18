from flask import Blueprint, g, jsonify, request

from src.routes.decorators import require_auth
from src.services import notes

notes_bp = Blueprint("notes", __name__, url_prefix="/notes")


@notes_bp.post("")
@require_auth
def create_note():
    data = request.get_json(silent=True)
    try:
        result = notes.create_note(g.user_id, data)
    except notes.ValidationError as error:
        return jsonify({"error": error.message}), 400
    return jsonify(result), 201


@notes_bp.get("")
@require_auth
def list_notes():
    return jsonify({"notes": notes.list_notes(g.user_id)}), 200


@notes_bp.get("/<int:note_id>")
@require_auth
def get_note(note_id):
    result = notes.get_note(g.user_id, note_id)
    if result is None:
        return jsonify({"error": "Note not found"}), 404
    return jsonify(result), 200


@notes_bp.patch("/<int:note_id>")
@require_auth
def update_note(note_id):
    data = request.get_json(silent=True)
    try:
        result = notes.update_note(g.user_id, note_id, data)
    except notes.ValidationError as error:
        return jsonify({"error": error.message}), 400
    if result is None:
        return jsonify({"error": "Note not found"}), 404
    return jsonify(result), 200


@notes_bp.delete("/<int:note_id>")
@require_auth
def delete_note(note_id):
    if not notes.delete_note(g.user_id, note_id):
        return jsonify({"error": "Note not found"}), 404
    return "", 204
