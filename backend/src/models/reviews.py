"""Raw SQL data-access functions for review state and history."""

from datetime import datetime, time, timedelta, timezone

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
                "SELECT c.id, c.front, c.back, FALSE AS is_new, rs.due_at, c.position "
                "FROM cards AS c "
                "JOIN review_state AS rs "
                "ON rs.card_id = c.id AND rs.user_id = %s "
                "WHERE c.set_id = %s AND rs.due_at <= %s "
                "ORDER BY rs.due_at ASC, c.position ASC, c.id ASC LIMIT 50"
                "), new_cards AS ("
                "SELECT c.id, c.front, c.back, TRUE AS is_new, "
                "NULL::timestamptz AS due_at, c.position "
                "FROM cards AS c "
                "LEFT JOIN review_state AS rs "
                "ON rs.card_id = c.id AND rs.user_id = %s "
                "WHERE c.set_id = %s AND rs.card_id IS NULL "
                "ORDER BY c.position ASC, c.id ASC LIMIT 10"
                ") "
                "SELECT id, front, back, is_new FROM ("
                "SELECT * FROM due_cards UNION ALL SELECT * FROM new_cards"
                ") AS queue "
                "ORDER BY is_new ASC, due_at ASC NULLS LAST, position ASC, id ASC LIMIT 50",
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


def get_history(user_id, now):
    today = now.date()
    thirty_day_start = today - timedelta(days=29)
    thirty_day_start_at = datetime.combine(thirty_day_start, time.min, tzinfo=timezone.utc)
    tomorrow_start_at = datetime.combine(
        today + timedelta(days=1), time.min, tzinfo=timezone.utc
    )
    upcoming_end_day = today + timedelta(days=14)
    upcoming_end_at = datetime.combine(
        upcoming_end_day + timedelta(days=1), time.min, tzinfo=timezone.utc
    )

    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*), COUNT(DISTINCT rl.card_id), "
                "COUNT(DISTINCT c.set_id) "
                "FROM review_logs AS rl "
                "JOIN cards AS c ON c.id = rl.card_id "
                "WHERE rl.user_id = %s",
                (user_id,),
            )
            totals = cursor.fetchone()

            cursor.execute(
                "WITH days AS ("
                "SELECT generate_series(%s::date, %s::date, INTERVAL '1 day')::date AS day"
                "), daily AS ("
                "SELECT (reviewed_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS reviews "
                "FROM review_logs "
                "WHERE user_id = %s AND reviewed_at >= %s AND reviewed_at < %s "
                "GROUP BY (reviewed_at AT TIME ZONE 'UTC')::date"
                ") "
                "SELECT days.day, COALESCE(daily.reviews, 0) "
                "FROM days LEFT JOIN daily ON daily.day = days.day "
                "ORDER BY days.day ASC",
                (thirty_day_start, today, user_id, thirty_day_start_at, tomorrow_start_at),
            )
            last_30_days = [
                {"date": day.isoformat(), "reviews": reviews}
                for day, reviews in cursor.fetchall()
            ]

            cursor.execute(
                "SELECT COUNT(*) FROM review_state "
                "WHERE user_id = %s AND due_at <= %s",
                (user_id, now),
            )
            overdue = cursor.fetchone()[0]

            cursor.execute(
                "WITH days AS ("
                "SELECT generate_series(%s::date, %s::date, INTERVAL '1 day')::date AS day"
                "), daily AS ("
                "SELECT (due_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS due "
                "FROM review_state "
                "WHERE user_id = %s AND due_at >= %s AND due_at < %s "
                "GROUP BY (due_at AT TIME ZONE 'UTC')::date"
                ") "
                "SELECT days.day, COALESCE(daily.due, 0) "
                "FROM days LEFT JOIN daily ON daily.day = days.day "
                "ORDER BY days.day ASC",
                (
                    today + timedelta(days=1),
                    upcoming_end_day,
                    user_id,
                    tomorrow_start_at,
                    upcoming_end_at,
                ),
            )
            upcoming_days = [
                {"date": day.isoformat(), "due": due}
                for day, due in cursor.fetchall()
            ]

            return {
                "totals": {
                    "reviews": totals[0],
                    "cards_reviewed": totals[1],
                    "sets_studied": totals[2],
                },
                "last_30_days": last_30_days,
                "upcoming": {"overdue": overdue, "days": upcoming_days},
            }
    finally:
        conn.close()
