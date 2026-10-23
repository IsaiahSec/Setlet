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
    assert any("CREATE TABLE IF NOT EXISTS study_sets" in sql for sql in store["executed"])
    assert any("CREATE TABLE IF NOT EXISTS cards" in sql for sql in store["executed"])
    assert any("CREATE TABLE IF NOT EXISTS review_state" in sql for sql in store["executed"])
    assert any("CREATE TABLE IF NOT EXISTS review_logs" in sql for sql in store["executed"])
    assert any("CREATE INDEX IF NOT EXISTS study_sets_owner_id_idx" in sql for sql in store["executed"])
    assert any(
        "CREATE INDEX IF NOT EXISTS cards_set_id_idx" in sql
        for sql in store["executed"]
    )
    assert any(
        "CREATE INDEX IF NOT EXISTS review_state_user_due_at_idx" in sql
        for sql in store["executed"]
    )
    assert any(
        "CREATE INDEX IF NOT EXISTS review_logs_user_reviewed_at_idx" in sql
        for sql in store["executed"]
    )
