"""Raw SQL data-access functions for review state and history."""

from src.db import get_connection


def get_study_data(set_id, user_id, now):
    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*), "
                "COUNT(*) FILTER (WHERE rs.card_id IS NULL), "
                "COUNT(*) FILTER (WHERE rs.due_at <= %s), "
                "COUNT(*) FILTER (WHERE rs.due_at > %s) "
                "FROM cards AS c "
                "LEFT JOIN review_state AS rs "
                "ON rs.card_id = c.id AND rs.user_id = %s "
                "WHERE c.set_id = %s",
                (now, now, user_id, set_id),
            )
            total, new, due, upcoming = cursor.fetchone()

            cursor.execute(
                "WITH due_cards AS ("
                "SELECT c.id, c.front, c.back, FALSE AS is_new, rs.due_at "
                "FROM cards AS c "
                "JOIN review_state AS rs "
                "ON rs.card_id = c.id AND rs.user_id = %s "
                "WHERE c.set_id = %s AND rs.due_at <= %s "
                "ORDER BY rs.due_at ASC, c.id ASC LIMIT 50"
                "), new_cards AS ("
                "SELECT c.id, c.front, c.back, TRUE AS is_new, "
                "NULL::timestamptz AS due_at "
                "FROM cards AS c "
                "LEFT JOIN review_state AS rs "
                "ON rs.card_id = c.id AND rs.user_id = %s "
                "WHERE c.set_id = %s AND rs.card_id IS NULL "
                "ORDER BY c.id ASC LIMIT 10"
                ") "
                "SELECT id, front, back, is_new FROM ("
                "SELECT * FROM due_cards UNION ALL SELECT * FROM new_cards"
                ") AS queue "
                "ORDER BY is_new ASC, due_at ASC NULLS LAST, id ASC LIMIT 50",
                (user_id, set_id, now, user_id, set_id),
            )
            cards = [
                dict(zip(("id", "front", "back", "is_new"), row))
                for row in cursor.fetchall()
            ]
            return cards, {
                "total": total,
                "new": new,
                "due": due,
                "upcoming": upcoming,
            }
    finally:
        conn.close()


def get_review_context(cursor, user_id, card_id):
    cursor.execute(
        "SELECT c.set_id FROM study_sets AS s "
        "JOIN cards AS c ON c.set_id = s.id "
        "WHERE c.id = %s AND (s.owner_id = %s OR s.visibility = 'public') "
        "FOR SHARE OF s FOR UPDATE OF c",
        (card_id, user_id),
    )
    card = cursor.fetchone()
    if card is None:
        return None

    cursor.execute(
        "SELECT ease_factor, interval_days, repetitions FROM review_state "
        "WHERE user_id = %s AND card_id = %s FOR UPDATE",
        (user_id, card_id),
    )
    return (card[0], *(cursor.fetchone() or (None, None, None)))


def save_review(cursor, user_id, card_id, rating, state, now):
    cursor.execute(
        "INSERT INTO review_state "
        "(user_id, card_id, ease_factor, interval_days, repetitions, "
        "due_at, last_reviewed_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s) "
        "ON CONFLICT (user_id, card_id) DO UPDATE SET "
        "ease_factor = EXCLUDED.ease_factor, "
        "interval_days = EXCLUDED.interval_days, "
        "repetitions = EXCLUDED.repetitions, "
        "due_at = EXCLUDED.due_at, "
        "last_reviewed_at = EXCLUDED.last_reviewed_at",
        (
            user_id,
            card_id,
            state.ease_factor,
            state.interval_days,
            state.repetitions,
            state.due_at,
            now,
        ),
    )
    cursor.execute(
        "INSERT INTO review_logs "
        "(user_id, card_id, rating, interval_days_after) "
        "VALUES (%s, %s, %s, %s)",
        (user_id, card_id, rating, state.interval_days),
    )
