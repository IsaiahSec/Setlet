"""Validation and business logic for study sets."""

from src.models import study_sets


class ValidationError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


def _validate_body(data):
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")


def _validate_title(title):
    if title is None:
        raise ValidationError("Title is required")
    if not isinstance(title, str):
        raise ValidationError("Title must be a string")
    title = title.strip()
    if not 1 <= len(title) <= 200:
        raise ValidationError("Title must be between 1 and 200 characters")
    return title


def _validate_description(description):
    if not isinstance(description, str):
        raise ValidationError("Description must be a string")
    if len(description) > 1000:
        raise ValidationError("Description must be at most 1000 characters")
    return description


def create_set(owner_id, data):
    _validate_body(data)
    title = _validate_title(data.get("title"))
    description = _validate_description(data.get("description", ""))
    return study_sets.create_set(owner_id, title, description)


def update_set(owner_id, set_id, data):
    _validate_body(data)
    fields = {}
    if "title" in data:
        fields["title"] = _validate_title(data["title"])
    if "description" in data:
        fields["description"] = _validate_description(data["description"])
    if "visibility" in data:
        visibility = data["visibility"]
        if not isinstance(visibility, str) or visibility not in ("private", "public"):
            raise ValidationError("Visibility must be 'private' or 'public'")
        fields["visibility"] = visibility
    return study_sets.update_set(owner_id, set_id, fields)


def _validate_page(value, default, minimum, maximum=None):
    if value is None:
        return default
    try:
        value = int(value)
    except (TypeError, ValueError):
        raise ValidationError("Invalid pagination value")
    if value < minimum or (maximum is not None and value > maximum):
        raise ValidationError("Invalid pagination value")
    return value


def list_public_sets(viewer_id, query, page, page_size):
    query = (query or "").strip()
    if len(query) > 100:
        raise ValidationError("Search query must be at most 100 characters")
    page = _validate_page(page, 1, 1)
    page_size = _validate_page(page_size, 20, 1, 50)
    terms = query.split()[:5]
    sets, total = study_sets.search_public_sets(viewer_id, terms, page, page_size)
    return {"sets": sets, "page": page, "page_size": page_size, "total": total}
