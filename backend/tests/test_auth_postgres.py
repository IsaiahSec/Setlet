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
