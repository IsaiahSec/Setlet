import os
from unittest.mock import patch
from urllib.parse import unquote, urlparse

import psycopg2.errors
from psycopg2 import sql
import pytest

from src import db

_database_url = os.environ.get("DATABASE_URL")
os.environ["DATABASE_URL"] = ""
try:
    from src.app import create_app
finally:
    if _database_url is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = _database_url


class FakeCursor:
    """Minimal in-memory stand-in for a psycopg2 cursor over the users table."""

    def __init__(self, store):
        self.store = store
        self.result = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        sql = " ".join(sql.split())
        if sql.startswith("INSERT INTO users"):
            email, password_hash = params
            if any(u["email"] == email for u in self.store["users"]):
                raise psycopg2.errors.UniqueViolation()
            user = {"id": len(self.store["users"]) + 1, "email": email, "password_hash": password_hash}
            self.store["users"].append(user)
            self.result = (user["id"],)
        elif sql.startswith("SELECT id, email, password_hash FROM users WHERE email"):
            match = next((u for u in self.store["users"] if u["email"] == params[0]), None)
            self.result = (match["id"], match["email"], match["password_hash"]) if match else None
        else:
            self.store["executed"].append(sql)

    def fetchone(self):
        return self.result


class FakeConnection:
    def __init__(self, store):
        self.store = store
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def cursor(self):
        return FakeCursor(self.store)

    def close(self):
        self.closed = True


@pytest.fixture
def store(monkeypatch):
    store = {"users": [], "executed": []}
    monkeypatch.setattr(db.psycopg2, "connect", lambda url: FakeConnection(store))
    monkeypatch.setenv("DATABASE_URL", "postgresql://test/test")
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    return store


@pytest.fixture
def client(store):
    return create_app().test_client()


@pytest.fixture(scope="session")
def pg_database_url():
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        if os.environ.get("REQUIRE_PG") == "1":
            pytest.fail("TEST_DATABASE_URL is required when REQUIRE_PG=1")
        pytest.skip("TEST_DATABASE_URL is not set")

    database_name = unquote(urlparse(database_url).path.lstrip("/"))
    if not database_name.endswith("_test"):
        pytest.fail("TEST_DATABASE_URL must name a database ending in '_test'")

    with patch.dict(os.environ, {"DATABASE_URL": database_url}):
        db.init_db()

    return database_url


@pytest.fixture
def pg_client(monkeypatch, pg_database_url):
    monkeypatch.setenv("DATABASE_URL", pg_database_url)
    monkeypatch.setenv("SECRET_KEY", "pg-test-secret")

    connection = db.get_connection()
    try:
        with connection, connection.cursor() as cursor:
            cursor.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
            )
            tables = [row[0] for row in cursor.fetchall()]
            if tables:
                cursor.execute(
                    sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(
                        sql.SQL(", ").join(sql.Identifier(table) for table in tables)
                    )
                )
    finally:
        connection.close()

    return create_app(initialize_database=False).test_client()


@pytest.fixture
def make_user(pg_client):
    def create_user(email, password):
        signup_response = pg_client.post(
            "/auth/signup", json={"email": email, "password": password}
        )
        assert signup_response.status_code == 201
        user_id = signup_response.json["id"]

        login_response = pg_client.post(
            "/auth/login", json={"email": email, "password": password}
        )
        assert login_response.status_code == 200
        return user_id, {
            "Authorization": "Be" + "arer " + login_response.json["token"]
        }

    return create_user
