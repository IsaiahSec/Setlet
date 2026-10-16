# Setlet Backend

Flask API backend for Setlet.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Configuration

Set these environment variables (a local `.env` file is loaded automatically):

- `DATABASE_URL` - PostgreSQL connection string (e.g. Render's Postgres URL)
- `SECRET_KEY` - secret used to sign auth tokens
- `FRONTEND_ORIGIN` - allowed frontend origin for CORS (defaults to `http://localhost:5173`; set to `https://setlet.vercel.app` in production)

## Run (development)

```bash
flask --app src.app run --debug
```

## Test

```bash
pytest
```

## Running tests against PostgreSQL

Create a dedicated test database:

```bash
createdb setlet_test
```

Set `TEST_DATABASE_URL` to point to that database before running pytest. For
example, in PowerShell:

```powershell
$env:TEST_DATABASE_URL = "postgresql://<user>:<password>@localhost:5432/setlet_test"
```

The PostgreSQL-backed smoke tests only run when `TEST_DATABASE_URL` is set and
refuse to connect unless the database name ends in `_test`.

## Endpoints

- `POST /auth/signup` - register with an email and password; returns the new user ID.
- `POST /auth/login` - authenticate with an email and password; returns a bearer token.
- `GET /auth/me` - return the authenticated user's ID and email. Send the token using an Authorization bearer header.
- `POST /sets` - create a private study set.
- `GET /sets` - list the authenticated user's study sets.
- `GET /sets/<id>` - read one of the authenticated user's study sets.
- `PATCH /sets/<id>` - rename or update the description of an owned study set.
- `DELETE /sets/<id>` - delete an owned study set.
- `POST /sets/<id>/cards` - add a card to an owned set (`front` and `back`, each 1–2,000 trimmed characters).
- `PATCH /sets/<id>/cards/<card_id>` - update a card's `front` and/or `back`.
- `DELETE /sets/<id>/cards/<card_id>` - delete a card from an owned set.

`GET /sets/<id>` includes its cards ordered by ID. `GET /sets` includes a
`card_count` for each set. Deleting a set cascades to its cards.

## Structure

- `src/routes/` - Flask route/blueprint definitions (one file per resource: sets, cards, auth, etc.)
- `src/services/` - business logic (SM-2 scheduling, note derivation, GitHub feedback integration)
- `src/models/` - raw SQL data-access functions per table (no ORM)
- `src/db.py` - PostgreSQL connection handling (psycopg2)
- `tests/` - pytest test suite, mirrors the `src/` structure
