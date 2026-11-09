"""Raw SQL data-access functions for notes."""

from src.db import get_connection

_NOTE_FIELDS = "id, title, body, created_at"


def _note_from_row(row):
    if row is None:
        return None
    return dict(zip(("id", "title", "body", "created_at"), row))


def create_note(user_id, title, body):
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO notes (user_id, title, body) "
                "VALUES (%s, %s, %s) "
                f"RETURNING {_NOTE_FIELDS}",
                (user_id, title, body),
            )
            return _note_from_row(cur.fetchone())
    finally:
        conn.close()


def list_notes(user_id):
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, created_at FROM notes "
                "WHERE user_id = %s "
                "ORDER BY created_at DESC, id DESC",
                (user_id,),
            )
            return [
                dict(zip(("id", "title", "created_at"), row))
                for row in cur.fetchall()
            ]
    finally:
        conn.close()


def get_note(user_id, note_id):
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT {_NOTE_FIELDS} FROM notes "
                "WHERE id = %s AND user_id = %s",
                (note_id, user_id),
            )
            return _note_from_row(cur.fetchone())
    finally:
        conn.close()


def update_note(user_id, note_id, fields):
    updates = []
    values = []
    for field in ("title", "body"):
        if field in fields:
            updates.append(f"{field} = %s")
            values.append(fields[field])

    if not updates:
        return get_note(user_id, note_id)

    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE notes SET "
                + ", ".join(updates)
                + f" WHERE id = %s AND user_id = %s RETURNING {_NOTE_FIELDS}",
                (*values, note_id, user_id),
            )
            return _note_from_row(cur.fetchone())
    finally:
        conn.close()


def delete_note(user_id, note_id):
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "DELETE FROM notes WHERE id = %s AND user_id = %s",
                (note_id, user_id),
            )
            return cur.rowcount > 0
    finally:
        conn.close()
