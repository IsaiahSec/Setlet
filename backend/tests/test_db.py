import pytest

from src import db


def test_get_connection_requires_database_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError):
        db.get_connection()


def test_get_connection_uses_database_url(store):
    conn = db.get_connection()

    assert conn.store is store


def test_init_db_creates_users_table(store):
    db.init_db()

    assert any("CREATE TABLE IF NOT EXISTS users" in sql for sql in store["executed"])
