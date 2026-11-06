import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest

from src.app import create_app
from src.db import get_connection
from src.services import review as review_service


NOW = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)


def create_set(client, headers, title="Review set"):
    response = client.post("/sets", headers=headers, json={"title": title})
    assert response.status_code == 201
    return response.json


def create_card(client, headers, set_id, front="Front", back="Back"):
    response = client.post(
        f"/sets/{set_id}/cards",
        headers=headers,
        json={"front": front, "back": back},
    )
    assert response.status_code == 201
    return response.json


def fetch_one(query, values):
    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute(query, values)
            return cursor.fetchone()
    finally:
        conn.close()


def test_review_indexes_are_created(pg_client):
    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute(
                "SELECT indexname FROM pg_indexes "
                "WHERE schemaname = 'public' "
                "AND indexname IN (%s, %s)",
                (
                    "review_state_user_due_at_idx",
                    "review_logs_user_reviewed_at_idx",
                ),
            )
            indexes = {row[0] for row in cursor.fetchall()}
    finally:
        conn.close()

    assert indexes == {
        "review_state_user_due_at_idx",
        "review_logs_user_reviewed_at_idx",
    }


def test_review_inserts_then_updates_state_and_appends_logs(
    pg_client, make_user, monkeypatch
):
    user_id, headers = make_user("review-owner@example.com", "correct horse")
    study_set = create_set(pg_client, headers)
    card = create_card(pg_client, headers, study_set["id"])
    monkeypatch.setattr(review_service, "utcnow", lambda: NOW)

    first = pg_client.post(
        f"/cards/{card['id']}/review", headers=headers, json={"rating": 3}
    )

    assert first.status_code == 200
    assert first.json["card_id"] == card["id"]
    assert first.json["interval_days"] == 1
    assert first.json["ease_factor"] == 2.5
    assert datetime.fromisoformat(first.json["due_at"]).tzinfo is not None
    assert first.json["due_at"].endswith("+00:00")
    assert fetch_one(
        "SELECT COUNT(*), ease_factor, interval_days, repetitions, due_at, "
        "last_reviewed_at FROM review_state WHERE user_id = %s AND card_id = %s "
        "GROUP BY ease_factor, interval_days, repetitions, due_at, last_reviewed_at",
        (user_id, card["id"]),
    ) == (1, 2.5, 1, 1, NOW + timedelta(days=1), NOW)
    assert fetch_one(
        "SELECT rating, interval_days_after FROM review_logs "
        "WHERE user_id = %s AND card_id = %s",
        (user_id, card["id"]),
    ) == (3, 1)

    second_now = NOW + timedelta(days=1)
    monkeypatch.setattr(review_service, "utcnow", lambda: second_now)
    second = pg_client.post(
        f"/cards/{card['id']}/review", headers=headers, json={"rating": 3}
    )

    assert second.status_code == 200
    assert second.json["interval_days"] == 3
    assert fetch_one(
        "SELECT COUNT(*), interval_days, repetitions FROM review_state "
        "WHERE user_id = %s AND card_id = %s "
        "GROUP BY interval_days, repetitions",
        (user_id, card["id"]),
    ) == (1, 3, 2)
    assert fetch_one(
        "SELECT COUNT(*) FROM review_logs WHERE user_id = %s AND card_id = %s",
        (user_id, card["id"]),
    ) == (2,)


def test_concurrent_reviews_use_the_latest_state(pg_client, make_user, monkeypatch):
    user_id, headers = make_user("concurrent-review@example.com", "correct horse")
    study_set = create_set(pg_client, headers)
    card = create_card(pg_client, headers, study_set["id"])
    monkeypatch.setattr(review_service, "utcnow", lambda: NOW)
    initial = pg_client.post(
        f"/cards/{card['id']}/review", headers=headers, json={"rating": 3}
    )
    assert initial.status_code == 200

    lock_conn = get_connection()
    with lock_conn.cursor() as cursor:
        cursor.execute("SELECT id FROM cards WHERE id = %s FOR UPDATE", (card["id"],))

    def submit_review():
        client = create_app(initialize_database=False).test_client()
        return client.post(
            f"/cards/{card['id']}/review", headers=headers, json={"rating": 3}
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(submit_review) for _ in range(2)]
        try:
            deadline = time.monotonic() + 10
            waiting_reviews = 0
            while time.monotonic() < deadline:
                conn = get_connection()
                try:
                    with conn, conn.cursor() as cursor:
                        cursor.execute(
                            "SELECT COUNT(*) FROM pg_stat_activity "
                            "WHERE datname = current_database() "
                            "AND wait_event_type = 'Lock' "
                            "AND query LIKE %s",
                            ("SELECT c.set_id FROM study_sets AS s JOIN cards AS c%",),
                        )
                        waiting_reviews = cursor.fetchone()[0]
                finally:
                    conn.close()
                if waiting_reviews == 2:
                    break
                time.sleep(0.05)
            assert waiting_reviews == 2
        finally:
            lock_conn.rollback()
            lock_conn.close()

        responses = [future.result(timeout=10) for future in futures]

    assert [response.status_code for response in responses] == [200, 200]
    assert fetch_one(
        "SELECT interval_days, repetitions FROM review_state "
        "WHERE user_id = %s AND card_id = %s",
        (user_id, card["id"]),
    ) == (8, 3)
    assert fetch_one(
        "SELECT COUNT(*) FROM review_logs WHERE user_id = %s AND card_id = %s",
        (user_id, card["id"]),
    ) == (3,)


def test_public_set_review_state_is_isolated_between_users(
    pg_client, make_user, monkeypatch
):
    _, owner_headers = make_user("isolation-owner@example.com", "correct horse")
    first_user_id, first_headers = make_user(
        "isolation-first@example.com", "correct horse"
    )
    _, second_headers = make_user("isolation-second@example.com", "correct horse")
    study_set = create_set(pg_client, owner_headers)
    card = create_card(pg_client, owner_headers, study_set["id"])
    pg_client.patch(
        f"/sets/{study_set['id']}",
        headers=owner_headers,
        json={"visibility": "public"},
    )
    monkeypatch.setattr(review_service, "utcnow", lambda: NOW)

    rated = pg_client.post(
        f"/cards/{card['id']}/review", headers=first_headers, json={"rating": 3}
    )
    second_queue = pg_client.get(
        f"/sets/{study_set['id']}/study", headers=second_headers
    )

    assert rated.status_code == 200
    assert second_queue.status_code == 200
    assert second_queue.json["cards"] == [
        {"id": card["id"], "front": "Front", "back": "Back", "is_new": True}
    ]
    assert second_queue.json["counts"] == {
        "total": 1,
        "new": 1,
        "due": 0,
        "upcoming": 0,
    }
    assert fetch_one(
        "SELECT COUNT(*) FROM review_state WHERE user_id = %s AND card_id = %s",
        (first_user_id, card["id"]),
    ) == (1,)


def test_reviewed_card_leaves_queue_until_due_again(
    pg_client, make_user, monkeypatch
):
    _, headers = make_user("queue-owner@example.com", "correct horse")
    study_set = create_set(pg_client, headers)
    card = create_card(pg_client, headers, study_set["id"])
    monkeypatch.setattr(review_service, "utcnow", lambda: NOW)

    reviewed = pg_client.post(
        f"/cards/{card['id']}/review", headers=headers, json={"rating": 3}
    )
    next_queue = pg_client.get(
        f"/sets/{study_set['id']}/study", headers=headers
    )

    assert reviewed.status_code == 200
    assert next_queue.json["cards"] == []
    assert next_queue.json["counts"] == {
        "total": 1,
        "new": 0,
        "due": 0,
        "upcoming": 1,
    }

    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute(
                "UPDATE review_state SET due_at = %s WHERE card_id = %s",
                (NOW - timedelta(minutes=1), card["id"]),
            )
    finally:
        conn.close()

    due_queue = pg_client.get(f"/sets/{study_set['id']}/study", headers=headers)
    assert due_queue.json["cards"] == [
        {"id": card["id"], "front": "Front", "back": "Back", "is_new": False}
    ]
    assert due_queue.json["counts"]["due"] == 1


def test_study_counts_include_whole_set_and_only_callers_state(
    pg_client, make_user, monkeypatch
):
    user_id, headers = make_user("counts-owner@example.com", "correct horse")
    study_set = create_set(pg_client, headers)
    cards = [
        create_card(pg_client, headers, study_set["id"], front=f"Front {index}")
        for index in range(4)
    ]
    monkeypatch.setattr(review_service, "utcnow", lambda: NOW)

    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            for card_id, due_at in (
                (cards[1]["id"], NOW - timedelta(days=1)),
                (cards[2]["id"], NOW + timedelta(days=1)),
                (cards[3]["id"], NOW),
            ):
                cursor.execute(
                    "INSERT INTO review_state (user_id, card_id, due_at, "
                    "last_reviewed_at) VALUES (%s, %s, %s, %s)",
                    (user_id, card_id, due_at, NOW),
                )
    finally:
        conn.close()

    response = pg_client.get(f"/sets/{study_set['id']}/study", headers=headers)

    assert response.status_code == 200
    assert response.json["counts"] == {
        "total": 4,
        "new": 1,
        "due": 2,
        "upcoming": 1,
    }


def test_study_queue_limits_new_cards_and_total_cards(
    pg_client, make_user, monkeypatch
):
    user_id, headers = make_user("queue-limits@example.com", "correct horse")
    study_set = create_set(pg_client, headers)
    monkeypatch.setattr(review_service, "utcnow", lambda: NOW)
    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            card_ids = []
            for index in range(65):
                cursor.execute(
                    "INSERT INTO cards (set_id, front, back) VALUES (%s, %s, %s) "
                    "RETURNING id",
                    (study_set["id"], f"Front {index}", f"Back {index}"),
                )
                card_ids.append(cursor.fetchone()[0])
            for index in range(5):
                cursor.execute(
                    "INSERT INTO review_state (user_id, card_id, due_at, "
                    "last_reviewed_at) VALUES (%s, %s, %s, %s)",
                    (
                        user_id,
                        card_ids[index],
                        NOW - timedelta(minutes=index + 1),
                        NOW,
                    ),
                )
    finally:
        conn.close()

    first_queue = pg_client.get(f"/sets/{study_set['id']}/study", headers=headers)
    assert len(first_queue.json["cards"]) == 15
    assert sum(card["is_new"] for card in first_queue.json["cards"]) == 10

    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            for index in range(5, 45):
                cursor.execute(
                    "INSERT INTO review_state (user_id, card_id, due_at, "
                    "last_reviewed_at) VALUES (%s, %s, %s, %s)",
                    (
                        user_id,
                        card_ids[index],
                        NOW - timedelta(minutes=index + 1),
                        NOW,
                    ),
                )
    finally:
        conn.close()

    full_queue = pg_client.get(f"/sets/{study_set['id']}/study", headers=headers)

    assert len(full_queue.json["cards"]) == 50
    assert sum(card["is_new"] for card in full_queue.json["cards"]) == 5
    assert [card["id"] for card in full_queue.json["cards"][:45]] == sorted(
        card_ids[:45], key=lambda card_id: -(card_id)
    )
    assert [card["id"] for card in full_queue.json["cards"][45:]] == card_ids[45:50]


def test_private_set_study_and_review_visibility_tracks_owner_changes(
    pg_client, make_user
):
    _, owner_headers = make_user("visibility-owner@example.com", "correct horse")
    _, other_headers = make_user("visibility-other@example.com", "correct horse")
    study_set = create_set(pg_client, owner_headers)
    card = create_card(pg_client, owner_headers, study_set["id"])
    study_url = f"/sets/{study_set['id']}/study"
    review_url = f"/cards/{card['id']}/review"

    for response in (
        pg_client.get(study_url, headers=other_headers),
        pg_client.post(review_url, headers=other_headers, json={"rating": 3}),
    ):
        assert response.status_code == 404
        assert response.json == {"error": "Set not found"}

    pg_client.patch(
        f"/sets/{study_set['id']}",
        headers=owner_headers,
        json={"visibility": "public"},
    )
    assert pg_client.get(study_url, headers=other_headers).status_code == 200
    assert (
        pg_client.post(review_url, headers=other_headers, json={"rating": 3}).status_code
        == 200
    )

    pg_client.patch(
        f"/sets/{study_set['id']}",
        headers=owner_headers,
        json={"visibility": "private"},
    )
    for response in (
        pg_client.get(study_url, headers=other_headers),
        pg_client.post(review_url, headers=other_headers, json={"rating": 3}),
    ):
        assert response.status_code == 404
        assert response.json == {"error": "Set not found"}


@pytest.mark.parametrize("rating", [0, 5, -1, "1", 1.0, True, False, None, []])
def test_invalid_ratings_return_400_without_writing(
    pg_client, make_user, rating
):
    user_id, headers = make_user("invalid-rating@example.com", "correct horse")
    study_set = create_set(pg_client, headers)
    card = create_card(pg_client, headers, study_set["id"])

    response = pg_client.post(
        f"/cards/{card['id']}/review", headers=headers, json={"rating": rating}
    )

    assert response.status_code == 400
    assert fetch_one(
        "SELECT COUNT(*) FROM review_state WHERE user_id = %s AND card_id = %s",
        (user_id, card["id"]),
    ) == (0,)
    assert fetch_one(
        "SELECT COUNT(*) FROM review_logs WHERE user_id = %s AND card_id = %s",
        (user_id, card["id"]),
    ) == (0,)


def test_failed_state_upsert_does_not_leave_a_review_log(pg_client, make_user):
    _, headers = make_user("failed-upsert@example.com", "correct horse")
    study_set = create_set(pg_client, headers)
    card = create_card(pg_client, headers, study_set["id"])
    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute(
                "CREATE FUNCTION fail_review_state_insert() RETURNS trigger "
                "LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; "
                "END $$"
            )
            cursor.execute(
                "CREATE TRIGGER fail_review_state_insert "
                "BEFORE INSERT OR UPDATE ON review_state "
                "FOR EACH ROW EXECUTE FUNCTION fail_review_state_insert()"
            )

        response = pg_client.post(
            f"/cards/{card['id']}/review", headers=headers, json={"rating": 3}
        )
        assert response.status_code == 500
        assert fetch_one(
            "SELECT COUNT(*) FROM review_logs WHERE card_id = %s", (card["id"],)
        ) == (0,)
        assert fetch_one(
            "SELECT COUNT(*) FROM review_state WHERE card_id = %s", (card["id"],)
        ) == (0,)
    finally:
        with conn, conn.cursor() as cursor:
            cursor.execute("DROP TRIGGER IF EXISTS fail_review_state_insert ON review_state")
            cursor.execute("DROP FUNCTION IF EXISTS fail_review_state_insert()")
        conn.close()


def test_deleting_card_or_set_cascades_review_rows(pg_client, make_user):
    _, headers = make_user("cascade-owner@example.com", "correct horse")
    study_set = create_set(pg_client, headers)
    first_card = create_card(pg_client, headers, study_set["id"], front="First")
    second_card = create_card(pg_client, headers, study_set["id"], front="Second")

    for card in (first_card, second_card):
        response = pg_client.post(
            f"/cards/{card['id']}/review", headers=headers, json={"rating": 3}
        )
        assert response.status_code == 200

    deleted_card = pg_client.delete(
        f"/sets/{study_set['id']}/cards/{first_card['id']}", headers=headers
    )
    assert deleted_card.status_code == 204
    assert fetch_one(
        "SELECT COUNT(*) FROM review_state WHERE card_id = %s", (first_card["id"],)
    ) == (0,)
    assert fetch_one(
        "SELECT COUNT(*) FROM review_logs WHERE card_id = %s", (first_card["id"],)
    ) == (0,)
    assert fetch_one(
        "SELECT COUNT(*) FROM review_state WHERE card_id = %s", (second_card["id"],)
    ) == (1,)
    assert fetch_one(
        "SELECT COUNT(*) FROM review_logs WHERE card_id = %s", (second_card["id"],)
    ) == (1,)

    deleted_set = pg_client.delete(f"/sets/{study_set['id']}", headers=headers)
    assert deleted_set.status_code == 204
    assert fetch_one(
        "SELECT COUNT(*) FROM review_state WHERE card_id = %s", (second_card["id"],)
    ) == (0,)
    assert fetch_one(
        "SELECT COUNT(*) FROM review_logs WHERE card_id = %s", (second_card["id"],)
    ) == (0,)


def test_study_and_review_require_authentication(pg_client, make_user):
    _, headers = make_user("auth-review@example.com", "correct horse")
    study_set = create_set(pg_client, headers)
    card = create_card(pg_client, headers, study_set["id"])

    assert pg_client.get(f"/sets/{study_set['id']}/study").status_code == 401
    assert pg_client.get("/history").status_code == 401
    assert pg_client.post(
        f"/cards/{card['id']}/review", json={"rating": 3}
    ).status_code == 401


def test_history_returns_zero_filled_ranges_for_user_without_reviews(
    pg_client, make_user, monkeypatch
):
    _, headers = make_user("history-empty@example.com", "correct horse")
    monkeypatch.setattr(review_service, "utcnow", lambda: NOW)

    response = pg_client.get("/history", headers=headers)

    assert response.status_code == 200
    assert response.json["totals"] == {
        "reviews": 0,
        "cards_reviewed": 0,
        "sets_studied": 0,
    }
    assert len(response.json["last_30_days"]) == 30
    assert all(entry["reviews"] == 0 for entry in response.json["last_30_days"])
    assert response.json["last_30_days"][0]["date"] == (NOW.date() - timedelta(days=29)).isoformat()
    assert response.json["last_30_days"][-1]["date"] == NOW.date().isoformat()
    assert response.json["upcoming"]["overdue"] == 0
    assert len(response.json["upcoming"]["days"]) == 14
    assert all(entry["due"] == 0 for entry in response.json["upcoming"]["days"])
    assert response.json["upcoming"]["days"][0]["date"] == (
        NOW.date() + timedelta(days=1)
    ).isoformat()
    assert response.json["upcoming"]["days"][-1]["date"] == (
        NOW.date() + timedelta(days=14)
    ).isoformat()


def test_history_totals_daily_and_upcoming_counts_are_correct(
    pg_client, make_user, monkeypatch
):
    user_id, headers = make_user("history-counts@example.com", "correct horse")
    monkeypatch.setattr(review_service, "utcnow", lambda: NOW)
    first_set = create_set(pg_client, headers, title="History one")
    second_set = create_set(pg_client, headers, title="History two")
    first_card = create_card(pg_client, headers, first_set["id"], front="A")
    second_card = create_card(pg_client, headers, first_set["id"], front="B")
    third_card = create_card(pg_client, headers, second_set["id"], front="C")

    for card_id in (first_card["id"], first_card["id"], second_card["id"], third_card["id"]):
        response = pg_client.post(
            f"/cards/{card_id}/review", headers=headers, json={"rating": 3}
        )
        assert response.status_code == 200

    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM review_logs WHERE user_id = %s ORDER BY id",
                (user_id,),
            )
            log_ids = [row[0] for row in cursor.fetchall()]
            reviewed_at_values = (
                NOW - timedelta(days=29),
                NOW,
                NOW - timedelta(days=1),
                NOW - timedelta(days=1, hours=2),
            )
            for review_log_id, reviewed_at in zip(log_ids, reviewed_at_values):
                cursor.execute(
                    "UPDATE review_logs SET reviewed_at = %s WHERE id = %s",
                    (reviewed_at, review_log_id),
                )

            cursor.execute(
                "UPDATE review_state SET due_at = %s WHERE user_id = %s AND card_id = %s",
                (NOW - timedelta(hours=1), user_id, first_card["id"]),
            )
            cursor.execute(
                "UPDATE review_state SET due_at = %s WHERE user_id = %s AND card_id = %s",
                (NOW + timedelta(days=1, hours=2), user_id, second_card["id"]),
            )
            cursor.execute(
                "UPDATE review_state SET due_at = %s WHERE user_id = %s AND card_id = %s",
                (NOW + timedelta(days=14, hours=3), user_id, third_card["id"]),
            )
    finally:
        conn.close()

    response = pg_client.get("/history", headers=headers)

    assert response.status_code == 200
    assert response.json["totals"] == {
        "reviews": 4,
        "cards_reviewed": 3,
        "sets_studied": 2,
    }
    by_day = {entry["date"]: entry["reviews"] for entry in response.json["last_30_days"]}
    assert by_day[(NOW.date() - timedelta(days=29)).isoformat()] == 1
    assert by_day[(NOW.date() - timedelta(days=1)).isoformat()] == 2
    assert by_day[NOW.date().isoformat()] == 1
    assert response.json["upcoming"]["overdue"] == 1
    due_by_day = {entry["date"]: entry["due"] for entry in response.json["upcoming"]["days"]}
    assert due_by_day[(NOW.date() + timedelta(days=1)).isoformat()] == 1
    assert due_by_day[(NOW.date() + timedelta(days=14)).isoformat()] == 1


def test_history_is_isolated_between_users_on_same_public_set(
    pg_client, make_user, monkeypatch
):
    _, owner_headers = make_user("history-owner@example.com", "correct horse")
    first_user_id, first_headers = make_user(
        "history-first@example.com", "correct horse"
    )
    second_user_id, second_headers = make_user(
        "history-second@example.com", "correct horse"
    )
    monkeypatch.setattr(review_service, "utcnow", lambda: NOW)
    study_set = create_set(pg_client, owner_headers, title="Shared history")
    card = create_card(pg_client, owner_headers, study_set["id"], front="shared")
    pg_client.patch(
        f"/sets/{study_set['id']}",
        headers=owner_headers,
        json={"visibility": "public"},
    )

    assert (
        pg_client.post(f"/cards/{card['id']}/review", headers=first_headers, json={"rating": 3}).status_code
        == 200
    )
    assert (
        pg_client.post(f"/cards/{card['id']}/review", headers=second_headers, json={"rating": 2}).status_code
        == 200
    )

    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute(
                "UPDATE review_logs SET reviewed_at = %s WHERE user_id = %s",
                (NOW - timedelta(days=5), first_user_id),
            )
            cursor.execute(
                "UPDATE review_logs SET reviewed_at = %s WHERE user_id = %s",
                (NOW - timedelta(days=1), second_user_id),
            )
            cursor.execute(
                "UPDATE review_state SET due_at = %s WHERE user_id = %s",
                (NOW - timedelta(minutes=1), first_user_id),
            )
            cursor.execute(
                "UPDATE review_state SET due_at = %s WHERE user_id = %s",
                (NOW + timedelta(days=2), second_user_id),
            )
    finally:
        conn.close()

    first_history = pg_client.get("/history", headers=first_headers)
    second_history = pg_client.get("/history", headers=second_headers)

    assert first_history.status_code == 200
    assert second_history.status_code == 200
    assert first_history.json["totals"] == {
        "reviews": 1,
        "cards_reviewed": 1,
        "sets_studied": 1,
    }
    assert second_history.json["totals"] == {
        "reviews": 1,
        "cards_reviewed": 1,
        "sets_studied": 1,
    }
    assert first_history.json["upcoming"]["overdue"] == 1
    assert second_history.json["upcoming"]["overdue"] == 0
    first_by_day = {
        entry["date"]: entry["reviews"] for entry in first_history.json["last_30_days"]
    }
    second_by_day = {
        entry["date"]: entry["reviews"] for entry in second_history.json["last_30_days"]
    }
    assert first_by_day[(NOW.date() - timedelta(days=5)).isoformat()] == 1
    assert second_by_day[(NOW.date() - timedelta(days=1)).isoformat()] == 1


def test_history_totals_drop_after_deleting_card_or_set(
    pg_client, make_user, monkeypatch
):
    _, headers = make_user("history-cascade@example.com", "correct horse")
    monkeypatch.setattr(review_service, "utcnow", lambda: NOW)
    study_set = create_set(pg_client, headers, title="Cascade history")
    first_card = create_card(pg_client, headers, study_set["id"], front="first")
    second_card = create_card(pg_client, headers, study_set["id"], front="second")

    for card in (first_card, second_card):
        response = pg_client.post(
            f"/cards/{card['id']}/review", headers=headers, json={"rating": 3}
        )
        assert response.status_code == 200

    before_delete = pg_client.get("/history", headers=headers)
    assert before_delete.json["totals"] == {
        "reviews": 2,
        "cards_reviewed": 2,
        "sets_studied": 1,
    }

    deleted_card = pg_client.delete(
        f"/sets/{study_set['id']}/cards/{first_card['id']}", headers=headers
    )
    assert deleted_card.status_code == 204
    after_card_delete = pg_client.get("/history", headers=headers)
    assert after_card_delete.json["totals"] == {
        "reviews": 1,
        "cards_reviewed": 1,
        "sets_studied": 1,
    }

    deleted_set = pg_client.delete(f"/sets/{study_set['id']}", headers=headers)
    assert deleted_set.status_code == 204
    after_set_delete = pg_client.get("/history", headers=headers)
    assert after_set_delete.json["totals"] == {
        "reviews": 0,
        "cards_reviewed": 0,
        "sets_studied": 0,
    }
