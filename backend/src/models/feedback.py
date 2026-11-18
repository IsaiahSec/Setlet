from datetime import timedelta

from src.db import get_connection


def is_blacklisted(user_id):
    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM feedback_blacklist WHERE user_id = %s",
                (user_id,),
            )
            return cursor.fetchone() is not None
    finally:
        conn.close()


def reserve_submission_slot(cursor, user_id, submitted_at):
    cursor.execute(
        "INSERT INTO feedback_limits (user_id, last_submitted_at) "
        "VALUES (%s, %s) "
        "ON CONFLICT (user_id) DO UPDATE "
        "SET last_submitted_at = EXCLUDED.last_submitted_at "
        "WHERE feedback_limits.last_submitted_at <= %s "
        "RETURNING last_submitted_at",
        (user_id, submitted_at, submitted_at - timedelta(hours=1)),
    )
    return cursor.fetchone() is not None
