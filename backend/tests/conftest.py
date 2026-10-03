import psycopg2.errors
import pytest

from src import db
from src.app import create_app


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
