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
- `GITHUB_FEEDBACK_TOKEN` - token used to create feedback issues in GitHub
- `GITHUB_REPO` - GitHub repository slug in `owner/repo` format for feedback issues

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
- `GET /sets?q=<text>` - list the authenticated user's study sets, optionally filtered by search terms.
- `GET /sets/public?q=<text>&owner_id=<id>&shared_from=<YYYY-MM-DD>&shared_to=<YYYY-MM-DD>&page=<n>&page_size=<n>` - search public study sets owned by other users, with optional owner/shared-date filters and pagination.
- `GET /sets/<id>` - read one of the authenticated user's study sets or a public set; includes cards, `owner_id`, `owner_name`, and `is_owner`.
- `GET /sets/recent` - list up to 4 recently viewed readable sets for the authenticated user, most recent first.
- `PATCH /sets/<id>` - rename, update the description, or set visibility to `private` or `public` on an owned study set.
- `DELETE /sets/<id>` - delete an owned study set.
- `POST /sets/<id>/cards` - add a card to an owned set (`front` and `back`, each 1–2,000 trimmed characters).
- `PATCH /sets/<id>/cards/<card_id>` - update a card's `front` and/or `back`.
- `DELETE /sets/<id>/cards/<card_id>` - delete a card from an owned set.
- `PUT /sets/<id>/cards/order` - owner-only card reorder. Body must be `{"card_ids": [ ... ]}` containing every card ID in the set exactly once.
- `GET /sets/<id>/study` - get the caller's due and new cards, plus set-wide counts.
- `POST /cards/<card_id>/review` - rate a visible card from 1 (Again) to 4 (Easy).
- `GET /history` - get caller-only review totals, a zero-filled UTC daily review series for the last 30 days (including today), and overdue/upcoming due counts for the next 14 days.
- `POST /feedback` - submit authenticated user feedback (`message`, 1-2000 trimmed chars) for GitHub issue filing, limited to one success per hour.

`cards` include an internal per-set `position` used for ordering. `GET
/sets/<id>` returns cards ordered by `position`, then `id`. New cards are
appended to the end of their set. Non-owners can read public sets but cannot
update them or their cards. `PUT /sets/<id>/cards/order` returns
`{"error":"Set not found"}` when the set is missing or not owned by the caller
(including public sets owned by another user), and returns `400` if `card_ids`
does not contain each card in the set exactly once. `GET /sets` remains
owner-only and includes a `card_count` for each set. Deleting a set cascades
to its cards.

Successful reads from `GET /sets/<id>` and `GET /sets/<id>/study` update the
caller's recent history in `recent_sets`. The table keeps one row per
`(user_id, set_id)` and stores only the latest four viewed sets per user.
`GET /sets/recent` applies visibility checks in SQL, so sets that are deleted
or no longer visible to the caller are automatically omitted.

Study progress is stored separately for each user. The study queue lists due
cards first, then at most 10 new cards, with a maximum of 50 cards total.
Submitting a review updates the schedule and appends a review log in one
transaction. Both endpoints require authentication and return 404 when the
set is not visible to the caller.

`GET /history` also requires authentication. It returns only aggregate counts
for the caller and no card/set text.

`GET /sets/public` requires authentication and returns only other users' public
sets. Search is case-insensitive across titles and descriptions, matching all
of up to five whitespace-separated terms. Pagination defaults to page 1 with
20 results per page and supports page sizes up to 50. `page` must be between
1 and 10,000. `owner_id` must be a positive integer. `shared_from` and
`shared_to` use `YYYY-MM-DD` and filter inclusively by UTC day; `shared_from`
cannot be after `shared_to`. Results include `shared_at`, a card count, and
the owner's name (the part of their email before `@`), but no cards or full
email address.

All datetime values returned by JSON responses use ISO 8601 format with a UTC
offset (for example, `2026-10-24T21:13:00+00:00`).

## Structure

- `src/routes/` - Flask route/blueprint definitions (one file per resource: sets, reviews, auth, etc.)
- `src/services/` - business logic (review validation and SM-2 scheduling)
- `src/models/` - raw SQL data-access functions per table (no ORM)
- `src/db.py` - PostgreSQL connection handling (psycopg2)
- `tests/` - pytest test suite, mirrors the `src/` structure
