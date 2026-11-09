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
                "INSERT INTO cards (set_id, front, back, position) "
                "SELECT s.id, %s, %s, "
                "COALESCE((SELECT MAX(c.position) FROM cards AS c WHERE c.set_id = s.id), 0) + 1 "
                "FROM study_sets AS s "
                "WHERE s.id = %s AND s.owner_id = %s "
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


def reorder_cards(owner_id, set_id, card_ids):
    """Reorder cards in an owned set, returning None if set missing/not owned."""
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM study_sets WHERE id = %s AND owner_id = %s",
                (set_id, owner_id),
            )
            if cur.fetchone() is None:
                return None

            cur.execute(
                "SELECT id FROM cards WHERE set_id = %s "
                "ORDER BY position ASC, id ASC",
                (set_id,),
            )
            existing_ids = [row[0] for row in cur.fetchall()]

            if (
                len(card_ids) != len(existing_ids)
                or len(set(card_ids)) != len(card_ids)
                or set(card_ids) != set(existing_ids)
            ):
                raise ValueError("card_ids must contain each card in the set exactly once")

            if card_ids:
                values_sql = ", ".join(["(%s, %s)"] * len(card_ids))
                values = []
                for position, card_id in enumerate(card_ids, start=1):
                    values.extend((card_id, position))
                cur.execute(
                    "UPDATE cards AS c "
                    "SET position = v.position "
                    f"FROM (VALUES {values_sql}) AS v(card_id, position) "
                    "WHERE c.id = v.card_id AND c.set_id = %s",
                    (*values, set_id),
                )

            cur.execute(
                "SELECT id, front, back FROM cards WHERE set_id = %s "
                "ORDER BY position ASC, id ASC",
                (set_id,),
            )
            return [
                dict(zip(("id", "front", "back"), row))
                for row in cur.fetchall()
            ]
    finally:
        conn.close()
