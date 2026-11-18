"""Validation and business logic for notes."""

from src.models import notes
from src.services.study_sets import ValidationError, _validate_body


def _reject_nul(field_name, value):
    if "\x00" in value:
        raise ValidationError(f"{field_name} must not contain NUL characters")


def _validate_title(title):
    if title is None:
        raise ValidationError("Title is required")
    if not isinstance(title, str):
        raise ValidationError("Title must be a string")
    _reject_nul("Title", title)
    title = title.strip()
    if not 1 <= len(title) <= 200:
        raise ValidationError("Title must be between 1 and 200 characters")
    return title


def _validate_body_text(body):
    if body is None:
        raise ValidationError("Body is required")
    if not isinstance(body, str):
        raise ValidationError("Body must be a string")
    _reject_nul("Body", body)
    if not 1 <= len(body) <= 50000:
        raise ValidationError("Body must be between 1 and 50000 characters")
    return body


def create_note(user_id, data):
    _validate_body(data)
    title = _validate_title(data.get("title"))
    body = _validate_body_text(data.get("body"))
    return notes.create_note(user_id, title, body)


def list_notes(user_id):
    return notes.list_notes(user_id)


def get_note(user_id, note_id):
    return notes.get_note(user_id, note_id)


def update_note(user_id, note_id, data):
    _validate_body(data)
    fields = {}
    if "title" in data:
        fields["title"] = _validate_title(data["title"])
    if "body" in data:
        fields["body"] = _validate_body_text(data["body"])
    return notes.update_note(user_id, note_id, fields)


def delete_note(user_id, note_id):
    return notes.delete_note(user_id, note_id)
