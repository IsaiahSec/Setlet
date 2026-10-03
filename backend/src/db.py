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
    finally:
        conn.close()
