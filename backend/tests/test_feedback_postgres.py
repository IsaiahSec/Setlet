import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest

from src.app import create_app
from src.db import get_connection
from src.services import feedback as feedback_service
from src.services import github as github_service

NOW = datetime(2026, 2, 3, 4, 5, 6, tzinfo=timezone.utc)


def fetch_feedback_limit(user_id):
    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute(
                "SELECT last_submitted_at FROM feedback_limits WHERE user_id = %s",
                (user_id,),
            )
            row = cursor.fetchone()
            return row[0] if row else None
    finally:
        conn.close()


def blacklist_user(user_id):
    conn = get_connection()
    try:
        with conn, conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO feedback_blacklist (user_id) VALUES (%s)",
                (user_id,),
            )
    finally:
        conn.close()


def test_feedback_success_calls_github_and_records_limit(pg_client, make_user, monkeypatch):
    user_id, headers = make_user("feedback-success@example.com", "correct horse")
    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW)
    calls = []

    def fake_create_issue(title, body, labels):
        calls.append((title, body, labels))

    monkeypatch.setattr(github_service, "create_feedback_issue", fake_create_issue)

    response = pg_client.post(
        "/feedback", headers=headers, json={"message": "  Great app feature  "}
    )

    assert response.status_code == 201
    assert response.json == {"message": "Thanks for your feedback"}
    assert calls == [
        (f"Feedback from Setlet user #{user_id}", "Great app feature", ["user-feedback"])
    ]
    assert fetch_feedback_limit(user_id) == NOW


def test_feedback_rate_limited_until_an_hour_passes(pg_client, make_user, monkeypatch):
    user_id, headers = make_user("feedback-rate@example.com", "correct horse")
    calls = []

    def fake_create_issue(title, body, labels):
        calls.append((title, body, labels))

    monkeypatch.setattr(github_service, "create_feedback_issue", fake_create_issue)
    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW)

    first = pg_client.post("/feedback", headers=headers, json={"message": "First"})

    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW + timedelta(minutes=59))
    second = pg_client.post("/feedback", headers=headers, json={"message": "Second"})

    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW + timedelta(hours=1, seconds=1))
    third = pg_client.post("/feedback", headers=headers, json={"message": "Third"})

    assert first.status_code == 201
    assert second.status_code == 429
    assert second.json == {"error": "You can send feedback once per hour"}
    assert third.status_code == 201
    assert calls == [
        (f"Feedback from Setlet user #{user_id}", "First", ["user-feedback"]),
        (f"Feedback from Setlet user #{user_id}", "Third", ["user-feedback"]),
    ]
    assert fetch_feedback_limit(user_id) == NOW + timedelta(hours=1, seconds=1)


def test_failed_submission_does_not_consume_hourly_limit(pg_client, make_user, monkeypatch):
    user_id, headers = make_user("feedback-failed-window@example.com", "correct horse")
    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW)
    monkeypatch.setattr(github_service, "create_feedback_issue", lambda *_: None)

    first = pg_client.post("/feedback", headers=headers, json={"message": "First"})
    assert first.status_code == 201
    assert fetch_feedback_limit(user_id) == NOW

    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW + timedelta(hours=1, seconds=1))

    def raise_issue(*_):
        raise github_service.GitHubFeedbackError("boom")

    monkeypatch.setattr(github_service, "create_feedback_issue", raise_issue)
    failed = pg_client.post("/feedback", headers=headers, json={"message": "Second"})
    assert fetch_feedback_limit(user_id) == NOW

    monkeypatch.setattr(github_service, "create_feedback_issue", lambda *_: None)
    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW + timedelta(hours=1, seconds=2))
    retry = pg_client.post("/feedback", headers=headers, json={"message": "Retry"})

    assert failed.status_code == 502
    assert failed.json == {"error": "Could not send feedback right now"}
    assert retry.status_code == 201
    assert fetch_feedback_limit(user_id) == NOW + timedelta(hours=1, seconds=2)


def test_github_failure_returns_502_and_allows_immediate_retry(
    pg_client, make_user, monkeypatch
):
    user_id, headers = make_user("feedback-failed-retry@example.com", "correct horse")
    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW)
    attempts = {"count": 0}

    def flaky_create_issue(*_):
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise github_service.GitHubFeedbackError("down")

    monkeypatch.setattr(github_service, "create_feedback_issue", flaky_create_issue)

    first = pg_client.post("/feedback", headers=headers, json={"message": "Try one"})
    second = pg_client.post("/feedback", headers=headers, json={"message": "Try two"})

    assert first.status_code == 502
    assert first.json == {"error": "Could not send feedback right now"}
    assert second.status_code == 201
    assert attempts["count"] == 2
    assert fetch_feedback_limit(user_id) == NOW


def test_blacklisted_user_gets_success_without_side_effects(
    pg_client, make_user, monkeypatch
):
    user_id, headers = make_user("feedback-blacklisted@example.com", "correct horse")
    blacklist_user(user_id)
    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW)
    calls = []
    monkeypatch.setattr(
        github_service,
        "create_feedback_issue",
        lambda *_: calls.append("called"),
    )

    response = pg_client.post("/feedback", headers=headers, json={"message": "Hidden"})

    assert response.status_code == 201
    assert response.json == {"message": "Thanks for your feedback"}
    assert calls == []
    assert fetch_feedback_limit(user_id) is None


@pytest.mark.parametrize(
    "payload",
    [
        {"message": ""},
        {"message": "   "},
        {"message": "x" * 2001},
        {"message": "bad\u0000message"},
        {"message": 10},
        {"message": True},
        {"message": None},
    ],
)
def test_feedback_validation_rejects_invalid_messages(
    pg_client, make_user, monkeypatch, payload
):
    user_id, headers = make_user("feedback-invalid@example.com", "correct horse")
    calls = []
    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW)
    monkeypatch.setattr(
        github_service,
        "create_feedback_issue",
        lambda *_: calls.append("called"),
    )

    response = pg_client.post("/feedback", headers=headers, json=payload)

    assert response.status_code == 400
    assert "error" in response.json
    assert calls == []
    assert fetch_feedback_limit(user_id) is None


def test_feedback_concurrent_requests_allow_only_one_success(
    pg_client, make_user, monkeypatch
):
    user_id, headers = make_user("feedback-concurrent@example.com", "correct horse")
    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW)
    calls = {"count": 0}

    def slow_create_issue(*_):
        calls["count"] += 1
        time.sleep(0.2)

    monkeypatch.setattr(github_service, "create_feedback_issue", slow_create_issue)

    def submit_feedback():
        client = create_app(initialize_database=False).test_client()
        return client.post(
            "/feedback",
            headers=headers,
            json={"message": "Concurrent feedback"},
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = [executor.submit(submit_feedback) for _ in range(2)]
        responses = [future.result(timeout=10) for future in responses]

    assert sorted(response.status_code for response in responses) == [201, 429]
    assert calls["count"] == 1
    assert fetch_feedback_limit(user_id) == NOW


def test_feedback_payload_uses_only_user_id_not_email_or_username(
    pg_client, make_user, monkeypatch
):
    user_id, headers = make_user("private-name@example.com", "correct horse")
    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW)
    seen = []

    def fake_create_issue(title, body, labels):
        seen.append((title, body, labels))

    monkeypatch.setattr(github_service, "create_feedback_issue", fake_create_issue)

    response = pg_client.post(
        "/feedback",
        headers=headers,
        json={"message": "No username please"},
    )

    assert response.status_code == 201
    assert seen == [
        (
            f"Feedback from Setlet user #{user_id}",
            "No username please",
            ["user-feedback"],
        )
    ]
    assert "private-name" not in seen[0][0]
    assert "@example.com" not in seen[0][0]
    assert "private-name" not in seen[0][1]
    assert "@example.com" not in seen[0][1]


def test_feedback_requires_authentication(pg_client):
    response = pg_client.post("/feedback", json={"message": "Hello"})

    assert response.status_code == 401
    assert response.json == {"error": "Authentication required"}


def test_feedback_missing_github_config_returns_502(pg_client, make_user, monkeypatch):
    user_id, headers = make_user("feedback-config@example.com", "correct horse")
    monkeypatch.setattr(feedback_service, "utcnow", lambda: NOW)
    monkeypatch.delenv("GITHUB_FEEDBACK_TOKEN", raising=False)
    monkeypatch.delenv("GITHUB_REPO", raising=False)

    response = pg_client.post(
        "/feedback", headers=headers, json={"message": "Missing config"}
    )

    assert response.status_code == 502
    assert response.json == {"error": "Could not send feedback right now"}
    assert fetch_feedback_limit(user_id) is None
