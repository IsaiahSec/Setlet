"""Authentication business logic: bcrypt password hashing and signed bearer tokens."""

import os

import bcrypt
from itsdangerous import BadSignature, URLSafeTimedSerializer

from src.models import users

TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
BCRYPT_MAX_PASSWORD_BYTES = 72
MAX_EMAIL_LENGTH = 254

# Hash compared against when the email is unknown, so that login takes
# similar time whether or not the account exists.
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt())


class ValidationError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


DuplicateEmailError = users.DuplicateEmailError


class InvalidCredentialsError(Exception):
    pass


def _serializer():
    secret_key = os.environ.get("SECRET_KEY")
    if not secret_key:
        raise RuntimeError("SECRET_KEY environment variable is not set")
    return URLSafeTimedSerializer(secret_key, salt="setlet-auth")


def generate_token(user_id):
    return _serializer().dumps({"user_id": user_id})


def verify_token(token):
    """Return the user id encoded in a valid, unexpired token, or None."""
    try:
        data = _serializer().loads(token, max_age=TOKEN_MAX_AGE_SECONDS)
    except BadSignature:
        return None
    return data.get("user_id")


def _normalize_email(email):
    if not isinstance(email, str) or not email.strip():
        raise ValidationError("Email is required")
    email = email.strip().lower()
    local, at, domain = email.partition("@")
    if (
        len(email) > MAX_EMAIL_LENGTH
        or not at
        or not local
        or "@" in domain
        or any(c.isspace() for c in email)
        or "." not in domain.strip(".")
    ):
        raise ValidationError("Email is invalid")
    return email


def _validate_password(password):
    if not isinstance(password, str) or not password:
        raise ValidationError("Password is required")
    if len(password.encode("utf-8")) > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValidationError("Password must be at most 72 bytes")
    return password


def signup(email, password):
    """Create a user with a bcrypt-hashed password and return the new user id.
    Raises ValidationError on bad input and DuplicateEmailError if the email exists."""
    email = _normalize_email(email)
    password = _validate_password(password)
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    return users.create_user(email, password_hash)


def login(email, password):
    """Return a signed token for valid credentials, else raise InvalidCredentialsError."""
    if not isinstance(email, str) or not isinstance(password, str):
        raise InvalidCredentialsError()
    user = users.get_user_by_email(email.strip().lower())
    stored_hash = user["password_hash"].encode("utf-8") if user else _DUMMY_HASH
    try:
        password_ok = bcrypt.checkpw(password.encode("utf-8"), stored_hash)
    except ValueError:
        password_ok = False
    if user is None or not password_ok:
        raise InvalidCredentialsError()
    return generate_token(user["id"])
