from src.services.auth import verify_token


def test_postgres_signup_then_login(pg_client, make_user):
    user_id, headers = make_user("postgres-user@example.com", "correct horse")

    assert verify_token(headers["Authorization"].split(" ", 1)[1]) == user_id


def test_postgres_duplicate_email_signup_returns_conflict(pg_client):
    payload = {"email": "postgres-duplicate@example.com", "password": "correct horse"}

    assert pg_client.post("/auth/signup", json=payload).status_code == 201
    response = pg_client.post("/auth/signup", json=payload)

    assert response.status_code == 409
