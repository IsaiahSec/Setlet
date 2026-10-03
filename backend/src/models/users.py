"""Raw SQL data-access functions for the users table."""

import psycopg2.errors

from src.db import get_connection


class DuplicateEmailError(Exception):
    pass


def create_user(email, password_hash):
    """Insert a user and return its id. Raises DuplicateEmailError if the email exists."""
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id",
                (email, password_hash),
            )
            return cur.fetchone()[0]
    except psycopg2.errors.UniqueViolation:
        raise DuplicateEmailError(email)
    finally:
        conn.close()


def get_user_by_email(email):
    """Return a dict with id, email and password_hash, or None if not found."""
    conn = get_connection()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash FROM users WHERE email = %s",
                (email,),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    return {"id": row[0], "email": row[1], "password_hash": row[2]}
