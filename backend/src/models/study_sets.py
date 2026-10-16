"""Raw SQL data-access functions for the study_sets table."""

from src.db import get_connection

_SET_FIELDS = "id, title, description, visibility, created_at, updated_at"
_SET_FIELDS_WITH_OWNER = "id, owner_id, title, description, visibility, created_at, updated_at"
_UPDATE_FIELDS = {"title": "title", "description": "description"}


def _set_from_row(row, include_owner=False):
    if row is None:
        return None
    fields = (
        ("id", "owner_id", "title", "description", "visibility", "created_at", "updated_at")
        if include_owner
        else ("id", "title", "description", "visibility", "created_at", "updated_at")
    )
    return dict(zip(fields, row))


def create_set(owner_id, title, description):
    """Insert a private study set and return its public fields."""
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO study_sets (owner_id, title, description) "
                "VALUES (%s, %s, %s) "
                f"RETURNING {_SET_FIELDS}",
                (owner_id, title, description),
            )
            return _set_from_row(cur.fetchone())
    finally:
        conn.close()


def list_sets(owner_id):
    """Return the owner's study sets, most recently updated first."""
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT {_SET_FIELDS} FROM study_sets "
                "WHERE owner_id = %s ORDER BY updated_at DESC, id DESC",
                (owner_id,),
            )
            return [_set_from_row(row) for row in cur.fetchall()]
    finally:
        conn.close()


def get_set(owner_id, set_id):
    """Return an owned study set including its owner id, or None."""
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT {_SET_FIELDS_WITH_OWNER} FROM study_sets "
                "WHERE id = %s AND owner_id = %s",
                (set_id, owner_id),
            )
            return _set_from_row(cur.fetchone(), include_owner=True)
    finally:
        conn.close()


def update_set(owner_id, set_id, fields):
    """Update only explicitly allowed fields and return the set, or None."""
    updates = [
        f"{_UPDATE_FIELDS[field]} = %s"
        for field in ("title", "description")
        if field in fields
    ]
    values = [fields[field] for field in ("title", "description") if field in fields]
    updates.append("updated_at = now()")

    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE study_sets SET "
                + ", ".join(updates)
                + " WHERE id = %s AND owner_id = %s "
                + f"RETURNING {_SET_FIELDS_WITH_OWNER}",
                (*values, set_id, owner_id),
            )
            return _set_from_row(cur.fetchone(), include_owner=True)
    finally:
        conn.close()


def delete_set(owner_id, set_id):
    """Delete an owned set, returning whether a row was deleted."""
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "DELETE FROM study_sets WHERE id = %s AND owner_id = %s",
                (set_id, owner_id),
            )
            return cur.rowcount > 0
    finally:
        conn.close()
