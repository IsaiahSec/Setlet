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

## Structure

- `src/routes/` - Flask route/blueprint definitions (one file per resource: sets, cards, auth, etc.)
- `src/services/` - business logic (SM-2 scheduling, note derivation, GitHub feedback integration)
- `src/models/` - raw SQL data-access functions per table (no ORM)
- `src/db.py` - PostgreSQL connection handling (psycopg2)
- `tests/` - pytest test suite, mirrors the `src/` structure
