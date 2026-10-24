from dataclasses import dataclass
from datetime import datetime, timedelta


DEFAULT_EASE_FACTOR = 2.5
DEFAULT_INTERVAL_DAYS = 0
DEFAULT_REPETITIONS = 0


@dataclass(frozen=True)
class ReviewState:
    ease_factor: float
    interval_days: int
    repetitions: int
    due_at: datetime


def next_state(ease_factor, interval_days, repetitions, rating, now):
    if (
        isinstance(rating, bool)
        or not isinstance(rating, int)
        or rating not in (1, 2, 3, 4)
    ):
        raise ValueError("Rating must be an integer from 1 to 4")

    if rating == 1:
        return ReviewState(
            ease_factor=max(1.3, ease_factor - 0.2),
            interval_days=0,
            repetitions=0,
            due_at=now + timedelta(minutes=10),
        )

    repetitions += 1
    if rating == 2:
        ease_factor = max(1.3, ease_factor - 0.15)
        interval_days = max(1, int(interval_days * 1.2 + 0.5))
    elif rating == 3:
        if repetitions == 1:
            interval_days = 1
        elif repetitions == 2:
            interval_days = 3
        else:
            interval_days = max(
                interval_days + 1, int(interval_days * ease_factor + 0.5)
            )
    else:
        ease_factor += 0.15
        if repetitions == 1:
            interval_days = 4
        else:
            interval_days = max(
                interval_days + 1,
                int(interval_days * ease_factor * 1.3 + 0.5),
            )

    interval_days = min(interval_days, 365)
    return ReviewState(
        ease_factor=ease_factor,
        interval_days=interval_days,
        repetitions=repetitions,
        due_at=now + timedelta(days=interval_days),
    )
