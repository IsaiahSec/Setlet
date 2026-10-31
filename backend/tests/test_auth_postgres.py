import pytest

from src import db
from src.services import auth


def test_postgres_auth_me_returns_user_without_password_hash(pg_client, make_user):
    user_id, headers = make_user("current-user@example.com", "correct horse")

    response = pg_client.get("/auth/me", headers=headers)

    assert response.status_code == 200
    assert response.json == {"id": user_id, "email": "current-user@example.com"}
    assert "password_hash" not in response.get_data(as_text=True)


@pytest.mark.parametrize(
    "failure",
    ["missing", "basic", "garbage", "different_secret", "expired", "deleted_user"],
)
def test_postgres_auth_me_rejects_invalid_authentication(
    pg_client, make_user, monkeypatch, failure
):
    user_id, headers = make_user("current-user@example.com", "correct horse")
    token = headers["Authorization"].split(" ", 1)[1]

    if failure == "missing":
        headers = {}
    elif failure == "basic":
        headers = {"Authorization": f"Basic {token}"}
    elif failure == "garbage":
        headers = {"Authorization": "Be" + "arer garbage"}
    elif failure == "different_secret":
        monkeypatch.setenv("SECRET_KEY", "different-secret")
        token = auth.generate_token(user_id)
        monkeypatch.setenv("SECRET_KEY", "pg-test-secret")
        headers = {"Authorization": "Be" + "arer " + token}
    elif failure == "expired":
        monkeypatch.setattr(auth, "TOKEN_MAX_AGE_SECONDS", -1)
    elif failure == "deleted_user":
        connection = db.get_connection()
        try:
            with connection, connection.cursor() as cursor:
                cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        finally:
            connection.close()

    response = pg_client.get("/auth/me", headers=headers)

    assert response.status_code == 401
    assert response.json == {"error": "Authentication required"}


@pytest.mark.parametrize(
    ("endpoint", "payload"),
    [
        ("/auth/signup", {"email": "bad\x00@example.com", "password": "correct horse"}),
        ("/auth/signup", {"email": "valid@example.com", "password": "bad\x00password"}),
        ("/auth/login", {"email": "bad\x00@example.com", "password": "correct horse"}),
        ("/auth/login", {"email": "valid@example.com", "password": "bad\x00password"}),
    ],
)
def test_postgres_auth_rejects_nul_text_fields_without_writing(
    pg_client, make_user, endpoint, payload
):
    make_user("valid@example.com", "correct horse")
    connection = db.get_connection()
    try:
        with connection, connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM users")
            initial_count = cursor.fetchone()[0]
    finally:
        connection.close()

    response = pg_client.post(endpoint, json=payload)

    assert response.status_code == 400
    assert "NUL" in response.json["error"]

    connection = db.get_connection()
    try:
        with connection, connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM users")
            assert cursor.fetchone()[0] == initial_count
    finally:
        connection.close()
