"""Raw SQL data-access functions for cards."""

from src.db import get_connection

_CARD_FIELDS = "id, set_id, front, back"
_UPDATE_FIELDS = {"front": "front", "back": "back"}


def _card_from_row(row):
    if row is None:
        return None
    return dict(zip(("id", "set_id", "front", "back"), row))


def create_card(owner_id, set_id, front, back):
    """Insert a card into an owned set, or return None if the set is not owned."""
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO cards (set_id, front, back) "
                "SELECT id, %s, %s FROM study_sets "
                "WHERE id = %s AND owner_id = %s "
                f"RETURNING {_CARD_FIELDS}",
                (front, back, set_id, owner_id),
            )
            return _card_from_row(cur.fetchone())
    finally:
        conn.close()


def update_card(owner_id, set_id, card_id, fields):
    """Update allow-listed fields on a card in an owned set, or return None."""
    updates = [
        f"{_UPDATE_FIELDS[field]} = %s"
        for field in ("front", "back")
        if field in fields
    ]
    values = [fields[field] for field in ("front", "back") if field in fields]
    updates.append("updated_at = now()")

    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE cards AS c SET "
                + ", ".join(updates)
                + " FROM study_sets AS s "
                + "WHERE c.set_id = s.id AND s.owner_id = %s "
                + "AND c.set_id = %s AND c.id = %s "
                + "RETURNING c.id, c.set_id, c.front, c.back",
                (*values, owner_id, set_id, card_id),
            )
            return _card_from_row(cur.fetchone())
    finally:
        conn.close()


def delete_card(owner_id, set_id, card_id):
    """Delete a card in an owned set, returning whether a row was deleted."""
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "DELETE FROM cards AS c USING study_sets AS s "
                "WHERE c.set_id = s.id AND s.owner_id = %s "
                "AND c.set_id = %s AND c.id = %s",
                (owner_id, set_id, card_id),
            )
            return cur.rowcount > 0
    finally:
        conn.close()
