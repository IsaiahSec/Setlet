"""Review-session validation and scheduling orchestration."""

from datetime import datetime, timezone

from src.db import get_connection
from src.models import reviews
from src.services.scheduling import (
    DEFAULT_EASE_FACTOR,
    DEFAULT_INTERVAL_DAYS,
    DEFAULT_REPETITIONS,
    next_state,
)


class ValidationError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


def utcnow():
    return datetime.now(timezone.utc)


def submit_review(user_id, card_id, rating):
    if (
        isinstance(rating, bool)
        or not isinstance(rating, int)
        or rating not in (1, 2, 3, 4)
    ):
        raise ValidationError("Rating must be an integer from 1 to 4")

    now = utcnow()
    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            current = reviews.get_review_context(cursor, user_id, card_id)
            if current is None:
                return None

            _, ease_factor, interval_days, repetitions = current
            state = next_state(
                ease_factor if ease_factor is not None else DEFAULT_EASE_FACTOR,
                interval_days if interval_days is not None else DEFAULT_INTERVAL_DAYS,
                repetitions if repetitions is not None else DEFAULT_REPETITIONS,
                rating,
                now,
            )
            reviews.save_review(cursor, user_id, card_id, rating, state, now)
    finally:
        conn.close()

    return {
        "card_id": card_id,
        "due_at": state.due_at,
        "interval_days": state.interval_days,
        "ease_factor": state.ease_factor,
    }
