"""Validation and business logic for study sets."""

from datetime import date

from src.models import study_sets


class ValidationError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


def _reject_nul(field_name, value):
    if "\x00" in value:
        raise ValidationError(f"{field_name} must not contain NUL characters")


def _validate_body(data):
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")


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


def _validate_description(description):
    if not isinstance(description, str):
        raise ValidationError("Description must be a string")
    _reject_nul("Description", description)
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


def _parse_search_terms(query):
    query = (query or "").strip()
    _reject_nul("Search query", query)
    if len(query) > 100:
        raise ValidationError("Search query must be at most 100 characters")
    return query.split()[:5]


def _validate_owner_id(owner_id):
    if owner_id is None:
        return None
    try:
        owner_id = int(owner_id)
    except (TypeError, ValueError):
        raise ValidationError("owner_id must be a positive integer")
    if owner_id <= 0:
        raise ValidationError("owner_id must be a positive integer")
    return owner_id


def _validate_date(value, field_name):
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{field_name} must be in YYYY-MM-DD format")


def list_sets(owner_id, query):
    terms = _parse_search_terms(query)
    return study_sets.list_sets(owner_id, terms)


def list_public_sets(
    viewer_id,
    query,
    page,
    page_size,
    owner_id=None,
    shared_from=None,
    shared_to=None,
):
    terms = _parse_search_terms(query)
    page = _validate_page(page, 1, 1, 10000)
    page_size = _validate_page(page_size, 20, 1, 50)
    owner_id = _validate_owner_id(owner_id)
    shared_from = _validate_date(shared_from, "shared_from")
    shared_to = _validate_date(shared_to, "shared_to")
    if (
        shared_from is not None
        and shared_to is not None
        and shared_from > shared_to
    ):
        raise ValidationError("shared_from must be on or before shared_to")
    sets, total = study_sets.search_public_sets(
        viewer_id,
        terms,
        page,
        page_size,
        owner_id=owner_id,
        shared_from=shared_from,
        shared_to=shared_to,
    )
    return {"sets": sets, "page": page, "page_size": page_size, "total": total}
