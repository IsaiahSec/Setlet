from datetime import datetime, timedelta, timezone

import pytest

from src.services.scheduling import (
    DEFAULT_EASE_FACTOR,
    DEFAULT_INTERVAL_DAYS,
    DEFAULT_REPETITIONS,
    next_state,
)


NOW = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
DEFAULT_STATE = (
    DEFAULT_EASE_FACTOR,
    DEFAULT_INTERVAL_DAYS,
    DEFAULT_REPETITIONS,
)


@pytest.mark.parametrize(
    ("rating", "expected"),
    [
        (1, (2.3, 0, 0, NOW + timedelta(minutes=10))),
        (2, (2.35, 1, 1, NOW + timedelta(days=1))),
        (3, (2.5, 1, 1, NOW + timedelta(days=1))),
        (4, (2.65, 4, 1, NOW + timedelta(days=4))),
    ],
)
def test_rating_from_default_state_returns_exact_next_state(rating, expected):
    state = next_state(*DEFAULT_STATE, rating, NOW)

    assert (
        state.ease_factor,
        state.interval_days,
        state.repetitions,
        state.due_at,
    ) == expected


def test_three_good_ratings_schedule_intervals_one_three_and_eight():
    ease_factor, interval_days, repetitions = DEFAULT_STATE
    intervals = []

    for _ in range(3):
        state = next_state(ease_factor, interval_days, repetitions, 3, NOW)
        ease_factor = state.ease_factor
        interval_days = state.interval_days
        repetitions = state.repetitions
        intervals.append(interval_days)

    assert intervals == [1, 3, 8]


def test_again_resets_streak_and_ease_never_falls_below_floor():
    state = next_state(1.35, 100, 12, 1, NOW)

    assert (state.ease_factor, state.interval_days, state.repetitions) == (1.3, 0, 0)
    assert state.due_at == NOW + timedelta(minutes=10)

    repeated_again = next_state(
        state.ease_factor, state.interval_days, state.repetitions, 1, NOW
    )

    assert repeated_again.ease_factor == 1.3


def test_easy_raises_ease_and_hard_lowers_it():
    hard = next_state(2.5, 2, 1, 2, NOW)
    easy = next_state(2.5, 2, 1, 4, NOW)

    assert hard.ease_factor < 2.5
    assert easy.ease_factor > 2.5


@pytest.mark.parametrize(
    ("ease_factor", "interval_days", "repetitions", "rating"),
    [
        (2.5, 1000, 1, 2),
        (2.5, 1000, 2, 3),
        (2.5, 1000, 1, 4),
    ],
)
def test_interval_is_capped_at_365_days(
    ease_factor, interval_days, repetitions, rating
):
    state = next_state(ease_factor, interval_days, repetitions, rating, NOW)

    assert state.interval_days == 365
    assert state.due_at == NOW + timedelta(days=365)


@pytest.mark.parametrize("rating", [0, 5, -1, None, "1", 1.0, 1.5, True, False])
def test_invalid_rating_raises_value_error(rating):
    with pytest.raises(ValueError):
        next_state(*DEFAULT_STATE, rating, NOW)
