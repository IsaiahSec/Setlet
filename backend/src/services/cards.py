"""Validation and business logic for cards."""

from src.models import cards
from src.services.study_sets import ValidationError, _validate_body


def _validate_text(field, value):
    if value is None:
        raise ValidationError(f"{field.capitalize()} is required")
    if not isinstance(value, str):
        raise ValidationError(f"{field.capitalize()} must be a string")
    value = value.strip()
    if not 1 <= len(value) <= 2000:
        raise ValidationError(
            f"{field.capitalize()} must be between 1 and 2000 characters"
        )
    return value


def create_card(owner_id, set_id, data):
    _validate_body(data)
    front = _validate_text("front", data.get("front"))
    back = _validate_text("back", data.get("back"))
    return cards.create_card(owner_id, set_id, front, back)


def update_card(owner_id, set_id, card_id, data):
    _validate_body(data)
    fields = {}
    for field in ("front", "back"):
        if field in data:
            fields[field] = _validate_text(field, data[field])
    return cards.update_card(owner_id, set_id, card_id, fields)
