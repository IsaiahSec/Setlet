from datetime import datetime, timezone

from src.db import get_connection
from src.models import feedback as feedback_model
from src.services import github


class ValidationError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


class RateLimitedError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


class DeliveryError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


def utcnow():
    return datetime.now(timezone.utc)


def _validate_message(message):
    if not isinstance(message, str):
        raise ValidationError("Message must be a string from 1 to 2000 characters")

    trimmed = message.strip()
    if not trimmed or len(trimmed) > 2000 or "\x00" in trimmed:
        raise ValidationError("Message must be a string from 1 to 2000 characters")
    return trimmed


def submit_feedback(user_id, message):
    cleaned_message = _validate_message(message)

    if feedback_model.is_blacklisted(user_id):
        return

    now = utcnow()
    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            if not feedback_model.reserve_submission_slot(cursor, user_id, now):
                raise RateLimitedError("You can send feedback once per hour")

            try:
                github.create_feedback_issue(
                    title=f"Feedback from Setlet user #{user_id}",
                    body=cleaned_message,
                    labels=["user-feedback"],
                )
            except github.GitHubFeedbackError as exc:
                raise DeliveryError("Could not send feedback right now") from exc
    finally:
        conn.close()
