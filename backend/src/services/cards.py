"""Validation and business logic for cards."""

from src.models import cards
from src.services.study_sets import ValidationError, _validate_body


def _validate_text(field, value):
    if value is None:
        raise ValidationError(f"{field.capitalize()} is required")
    if not isinstance(value, str):
        raise ValidationError(f"{field.capitalize()} must be a string")
    if "\x00" in value:
        raise ValidationError(f"{field.capitalize()} must not contain NUL characters")
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


def reorder_cards(owner_id, set_id, data):
    _validate_body(data)
    card_ids = data.get("card_ids")
    if not isinstance(card_ids, list):
        raise ValidationError("card_ids must be a list")
    if not all(type(card_id) is int for card_id in card_ids):
        raise ValidationError("card_ids must be a list of integers")
    try:
        return cards.reorder_cards(owner_id, set_id, card_ids)
    except ValueError as error:
        raise ValidationError(str(error)) from error
