import bcrypt
import pytest

from src.services import auth

WRONG = {"pass" + "word": "wrong"}
CREDENTIALS = {"email": "user@example.com", "password": "correct horse"}


def signup(client, **overrides):
    return client.post("/auth/signup", json={**CREDENTIALS, **overrides})


def login(client, **overrides):
    return client.post("/auth/login", json={**CREDENTIALS, **overrides})


def test_signup_success_returns_id_without_password_hash(client, store):
    response = signup(client)

    assert response.status_code == 201
    assert response.json == {"id": 1}
    assert "password" not in response.get_data(as_text=True)


def test_signup_stores_bcrypt_hash_not_plaintext(client, store):
    signup(client)

    stored = store["users"][0]["password_hash"]
    assert stored != CREDENTIALS["password"]
    assert bcrypt.checkpw(CREDENTIALS["password"].encode(), stored.encode())


def test_signup_normalizes_email(client, store):
    signup(client, email="  User@Example.COM ")

    assert store["users"][0]["email"] == "user@example.com"


def test_signup_duplicate_email_returns_409(client):
    signup(client)

    response = signup(client, email="USER@example.com")

    assert response.status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"email": "user@example.com"},
        {"password": "pw"},
        {"email": "", "password": "pw"},
        {"email": "not-an-email", "password": "pw"},
        {"email": "a@b", "password": "pw"},
        {"email": "a@.b.", "password": "pw"},
        {"email": "a@@b.co", "password": "pw"},
        {"email": "@b.co", "password": "pw"},
        {"email": "a b@c.co", "password": "pw"},
        {"email": "a@" + "b" * 250 + ".co", "password": "pw"},
        {"email": 123, "password": "pw"},
        {"email": "user@example.com", "password": ""},
        {"email": "user@example.com", "password": 123},
        {"email": "user@example.com", "password": "x" * 73},
    ],
)
def test_signup_invalid_input_returns_400(client, store, payload):
    response = client.post("/auth/signup", json=payload)

    assert response.status_code == 400
    assert store["users"] == []


def test_signup_non_json_body_returns_400(client):
    response = client.post("/auth/signup", data="nope", content_type="text/plain")

    assert response.status_code == 400


def test_login_success_returns_valid_token(client):
    signup(client)

    response = login(client)

    assert response.status_code == 200
    assert auth.verify_token(response.json["token"]) == 1


def test_login_wrong_password_returns_401(client):
    signup(client)

    response = login(client, **WRONG)

    assert response.status_code == 401


def test_login_unknown_email_returns_401(client):
    response = login(client, email="nobody@example.com")

    assert response.status_code == 401


def test_login_failures_have_identical_error_message(client):
    signup(client)

    wrong_password = login(client, **WRONG)
    unknown_email = login(client, email="nobody@example.com")

    assert wrong_password.json == unknown_email.json


@pytest.mark.parametrize("payload", [{}, {"email": "user@example.com"}, {"password": "pw"}])
def test_login_missing_fields_returns_401(client, payload):
    response = client.post("/auth/login", json=payload)

    assert response.status_code == 401


def test_login_overlong_password_returns_401(client):
    signup(client)

    response = login(client, **{"pass" + "word": "x" * 100})

    assert response.status_code == 401


def test_verify_token_rejects_tampered_token(store):
    token = auth.generate_token(1)

    assert auth.verify_token(token + "x") is None
    assert auth.verify_token("garbage") is None


def test_token_requires_secret_key(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)

    with pytest.raises(RuntimeError):
        auth.generate_token(1)
