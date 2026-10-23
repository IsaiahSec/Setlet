"""
PostgreSQL connection handling (psycopg2), per Specifications section
of the project proposal. The connection string is read from the
DATABASE_URL environment variable (as provided by Render's Postgres).
"""

import os

import psycopg2

USERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

STUDY_SETS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS study_sets (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

CARDS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    set_id INTEGER NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

REVIEW_STATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS review_state (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    due_at TIMESTAMPTZ NOT NULL,
    last_reviewed_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, card_id)
)
"""

REVIEW_LOGS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS review_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 4),
    interval_days_after INTEGER NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""


def get_connection():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return psycopg2.connect(database_url)


def init_db():
    """Create the tables the app needs if they do not exist yet."""
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(USERS_TABLE_SQL)
            cur.execute(STUDY_SETS_TABLE_SQL)
            cur.execute(CARDS_TABLE_SQL)
            cur.execute(REVIEW_STATE_TABLE_SQL)
            cur.execute(REVIEW_LOGS_TABLE_SQL)
            cur.execute(
                "CREATE INDEX IF NOT EXISTS study_sets_owner_id_idx "
                "ON study_sets(owner_id)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS cards_set_id_idx ON cards(set_id)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS review_state_user_due_at_idx "
                "ON review_state(user_id, due_at)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS review_logs_user_reviewed_at_idx "
                "ON review_logs(user_id, reviewed_at)"
            )
    finally:
        conn.close()
