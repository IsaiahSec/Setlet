"""Raw SQL data-access functions for the study_sets table."""

from src.db import get_connection

_SET_FIELDS = "id, title, description, visibility, created_at, updated_at"
_SET_FIELDS_WITH_OWNER = "id, owner_id, title, description, visibility, created_at, updated_at"
_UPDATE_FIELDS = {
    "title": "title",
    "description": "description",
    "visibility": "visibility",
}


def _set_from_row(row, include_owner=False):
    if row is None:
        return None
    fields = (
        ("id", "owner_id", "title", "description", "visibility", "created_at", "updated_at")
        if include_owner
        else ("id", "title", "description", "visibility", "created_at", "updated_at")
    )
    return dict(zip(fields, row))


def _include_cards(cur, set_id, study_set):
    cur.execute(
        "SELECT id, front, back FROM cards WHERE set_id = %s ORDER BY id ASC",
        (set_id,),
    )
    study_set["cards"] = [
        dict(zip(("id", "front", "back"), row))
        for row in cur.fetchall()
    ]
    return study_set


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
                f"SELECT {_SET_FIELDS}, "
                "(SELECT COUNT(*) FROM cards WHERE cards.set_id = study_sets.id) "
                "AS card_count FROM study_sets "
                "WHERE owner_id = %s ORDER BY updated_at DESC, id DESC",
                (owner_id,),
            )
            return [
                {**_set_from_row(row[:6]), "card_count": row[6]}
                for row in cur.fetchall()
            ]
    finally:
        conn.close()


def search_public_sets(viewer_id, terms, page, page_size):
    """Return matching public sets owned by other users and the full match count."""
    conditions = ["study_sets.visibility = 'public'", "study_sets.owner_id <> %s"]
    values = [viewer_id]
    for term in terms:
        escaped_term = (
            term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        pattern = f"%{escaped_term}%"
        conditions.append(
            "(study_sets.title ILIKE %s ESCAPE '\\' "
            "OR study_sets.description ILIKE %s ESCAPE '\\')"
        )
        values.extend((pattern, pattern))
    where_clause = " AND ".join(conditions)

    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) FROM study_sets WHERE {where_clause}",
                values,
            )
            total = cur.fetchone()[0]

            cur.execute(
                "SELECT study_sets.id, study_sets.title, study_sets.description, "
                "(SELECT COUNT(*) FROM cards WHERE cards.set_id = study_sets.id) "
                "AS card_count, study_sets.owner_id, "
                "split_part(users.email, '@', 1) AS owner_name, study_sets.updated_at "
                "FROM study_sets JOIN users ON users.id = study_sets.owner_id "
                f"WHERE {where_clause} "
                "ORDER BY study_sets.updated_at DESC, study_sets.id DESC "
                "LIMIT %s OFFSET %s",
                (*values, page_size, (page - 1) * page_size),
            )
            sets = [
                dict(
                    zip(
                        (
                            "id",
                            "title",
                            "description",
                            "card_count",
                            "owner_id",
                            "owner_name",
                            "updated_at",
                        ),
                        row,
                    )
                )
                for row in cur.fetchall()
            ]
            return sets, total
    finally:
        conn.close()


def get_set_for_viewer(set_id, viewer_id):
    """Return a visible study set, including its owner name and cards, or None."""
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "SELECT id, owner_id, title, description, visibility, created_at, "
                "updated_at, (SELECT split_part(email, '@', 1) FROM users "
                "WHERE users.id = study_sets.owner_id) AS owner_name "
                "FROM study_sets "
                "WHERE id = %s AND (owner_id = %s OR visibility = 'public')",
                (set_id, viewer_id),
            )
            row = cur.fetchone()
            study_set = _set_from_row(row[:7], include_owner=True) if row else None
            if study_set is None:
                return None
            study_set["owner_name"] = row[7]
            return _include_cards(cur, set_id, study_set)
    finally:
        conn.close()


def update_set(owner_id, set_id, fields):
    """Update only explicitly allowed fields and return the set, or None."""
    updates = [
        f"{_UPDATE_FIELDS[field]} = %s"
        for field in ("title", "description", "visibility")
        if field in fields
    ]
    values = [
        fields[field]
        for field in ("title", "description", "visibility")
        if field in fields
    ]
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
