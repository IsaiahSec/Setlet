# Project Architecture & Skeleton

## Project Overview

This project is a web application designed to allow users to create, manage, share, and study sets of learning material.

The application is planned around a separated frontend, backend, and data layer. This document represents the initial architecture and project skeleton.

---

## 1. Frontend

### Technology

The frontend is built using React with Vite.

### Structure

The initial frontend structure is organized into three primary areas:

- `components/` - reusable user interface components
- `pages/` - page-level components representing the main application views
- `services/` - code responsible for communication with backend services


### Frontend Pages

The frontend includes the following pages:

- `Login.jsx` - user login with form validation and API integration
- `Signup.jsx` - user registration with form validation and API integration
- `MySets.jsx` - displays the user's study sets and supports creating and deleting sets
- `SetEditor.jsx` - allows owners to edit study sets, manage flashcards, and change set visibility
- `PublicSets.jsx` - displays publicly available study sets with search and pagination
- `PublicSetView.jsx` - provides a read-only view of a public set and its flashcards
- `StudyReview.jsx` - interactive flashcard study sessions with review ratings and progress tracking

### Public Sets Features

The public browsing functionality is implemented in the frontend.

- Route `/public` displays public study sets.
- Search requests use a 300 ms debounce.
- Pagination supports Previous and Next navigation.
- Public set cards display title, description, card count, and owner name.
- Route `/public/:setId` displays a read-only public set and its flashcards.
- Users can navigate to `/study/:setId` to study a set.
- Set owners are redirected to `/mysets/:setId`.
- Missing sets display a "Set not found" message with a link back to Browse.
- The interface does not display owner email addresses or editing controls for other users' sets.

The frontend uses Vitest and React Testing Library to test public set listing, search, pagination, empty states, read-only display, owner redirects, and error handling.

### Study Review Feature

The Study Review page is implemented in `StudyReview.jsx` and styled with `StudyReview.css`.

- Users can open Study Review from My Sets or Set Editor.
- Flashcards display the front first and flip to show the back.
- Users can flip cards by clicking or pressing Space.
- Users can rate their recall using Again (1), Hard (2), Good (3), or Easy (4).
- Keyboard shortcuts 1–4 are supported.
- Again places the card back into the current review queue.
- The page displays review progress and a completion summary.
- Empty queues, loading errors, and missing sets have dedicated states.
- Failed review submissions display an error without advancing the card.
- `StudyReview.test.jsx` contains automated frontend tests.

The frontend uses these API endpoints:

- `GET /sets/<set_id>/study` to retrieve the study queue and counts.
- `POST /cards/<card_id>/review` with a rating from 1 to 4 to submit a review.

The backend requires authentication for these endpoints and stores review progress
per user. A card is returned when it is due or has no state for the caller; each
queue contains due cards first, up to 10 new cards, and at most 50 cards total.
Frontend tests use mocked API responses and do not verify database persistence.

### Service Layer

services/api.js provides frontend functions for communicating with backend API endpoints, including authentication, study sets, flashcards, and study review requests.

The API service provides functions for authentication, study set management, flashcard management, and public set browsing. The `listPublicSets(query, page, pageSize)` function calls `GET /sets/public` with search and pagination parameters. The `getSet(id)` function retrieves individual study sets. API errors include HTTP status codes so the frontend can distinguish missing resources from other failures.

---

## 2. Backend

### Technology

The backend is built using Python with Flask. Database access uses raw SQL via `psycopg2` (no ORM), per the project's Specifications.

### Structure

The initial backend structure is organized into three primary areas, mirroring the frontend's separation of concerns:

- `routes/` - Flask route/blueprint definitions, one file per resource
- `services/` - business logic that isn't just data access
- `models/` - data-access functions per table, written as raw SQL queries rather than ORM models
- `db.py` - PostgreSQL connection handling
- `tests/` - pytest suite, mirroring the structure above

The backend includes authentication and owner-scoped study-set mutations, with table-specific raw SQL models and service validation. Individual set reads and review endpoints are visible to the owner and to other users only when the set is public. Review progress is scoped to the authenticated user.

Authenticated users can list other users' public sets with `GET /sets/public`,
optionally searching titles and descriptions by keyword and paginating results.
The response includes set metadata, card counts, and the owner's email prefix,
but not card contents or full email addresses.

### API

MVP endpoints (`auth`, `sets`, `cards`, `reviews`) will be built first, matching the MVP scope in the project proposal and the frontend's initial page set. Feedback (GitHub API integration) and Notes/Derivation are proposal features but are explicitly excluded from MVP per the project proposal's MVP section, so their routes and services will be added after the MVP milestone, not as part of this skeleton. A `/health` endpoint currently exists as a placeholder to confirm the Flask app runs.

---

## 3. Database

### Technology

PostgreSQL, hosted on Render alongside the backend, accessed via `psycopg2` rather than an ORM.

### Initial Data Model

MVP tables, per the project proposal: `users`, `study_sets`, `cards`, `review_state`, `review_logs`. Two additional tables — `feedback_limits` and `notes` — are part of the full proposal scope but support post-MVP features, so their schemas will be implemented after the MVP milestone. `db.py` connects using the `DATABASE_URL` environment variable and creates tables on startup if they do not exist. Currently implemented:

- `users` - `id` (serial primary key), `email` (unique), `password_hash` (bcrypt), `created_at`
- `study_sets` - `id`, `owner_id` (references `users`), `title`, `description`, `visibility`, `created_at`, `updated_at`
- `cards` - `id`, `set_id` (references `study_sets` with `ON DELETE CASCADE`), `front`, `back`, `created_at`, `updated_at`; indexed by `set_id`
- `review_state`
  - `user_id` and `card_id` reference `users` and `cards` with `ON DELETE
    CASCADE` and form the composite primary key.
  - `ease_factor REAL NOT NULL DEFAULT 2.5`, `interval_days INTEGER NOT NULL
    DEFAULT 0`, and `repetitions INTEGER NOT NULL DEFAULT 0`.
  - `due_at TIMESTAMPTZ NOT NULL` and `last_reviewed_at TIMESTAMPTZ NOT NULL`;
    indexed by `(user_id, due_at)`.
- `review_logs`
  - `id SERIAL PRIMARY KEY`; `user_id` and `card_id` reference `users` and
    `cards` with `ON DELETE CASCADE`.
  - `rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 4)`,
    `interval_days_after INTEGER NOT NULL`, and
    `reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
  - Indexed by `(user_id, reviewed_at)`.

`GET /sets/<set_id>/study` returns the visible set, the caller's due and new cards,
and counts for the entire set. `POST /cards/<card_id>/review` validates a rating
from 1 to 4, calculates the next schedule, and writes the state and review log
atomically.

The authenticated set API supports creating, updating, and deleting cards under `/sets/<set_id>/cards`. Only the set owner can manipulate sets and cards. Owners can switch set visibility between `private` and `public`; individual set reads include cards ordered by ID, the owner's name, and whether the viewer is the owner. Set lists remain owner-only and include a `card_count`.

---

## 4. Authentication and Authorization

Email/password authentication, with passwords hashed using `bcrypt`. `POST /auth/signup` creates a user (`201` with the user id, `409` on duplicate email, `400` on invalid input). `POST /auth/login` returns a signed token (`itsdangerous`, keyed by the `SECRET_KEY` environment variable, valid 7 days) in the response body; an unknown email or wrong password both return `401` with the same error message. Clients send the token back as `Authorization: Bearer <token>` rather than using a session cookie, since the frontend and backend are on separate origins. Authorization is enforced at the query layer: users can only read/write their own sets, cards, and notes, and only public sets are visible outside their owner, per the project's functional requirements.

---

## 5. Frontend-Backend Integration

The frontend will communicate with the backend through an API.

Specific endpoints, request and response structures, and other integration details will be added as the backend structure is developed.

The backend enables CORS for the origin configured by the `FRONTEND_ORIGIN` environment variable (defaulting to `http://localhost:5173`). Set it to `https://setlet.vercel.app` in production. Requests may include the `Authorization` and `Content-Type` headers.

---

## 6. CI/CD

GitHub Actions runs on every pull request targeting `main`. The `backend-tests` job installs the dependencies in `backend/requirements.txt` and runs the pytest suite with an 80% coverage gate on `backend/src`. The `frontend-tests` job installs the frontend dependencies and runs the Vitest and React Testing Library suite. Both jobs must pass before a pull request can be merged.

---

## 7. Current Project Skeleton

```text
project/
├── .github/
│   └── workflows/
│       └── test.yml
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── MySets.jsx
│   │   │   ├── PublicSets.jsx
│   │   │   ├── SetEditor.jsx
│   │   │   └── StudyReview.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── decorators.py
│   │   │   ├── sets.py
│   │   │   └── reviews.py
│   │   ├── services/
│   │   │   ├── auth.py
│   │   │   ├── study_sets.py
│   │   │   └── review.py
│   │   ├── models/
│   │   │   ├── users.py
│   │   │   ├── study_sets.py
│   │   │   └── reviews.py
│   │   ├── app.py
│   │   └── db.py
│   ├── tests/
│   │   ├── test_study_sets_postgres.py
│   │   └── test_review_postgres.py
│   ├── requirements.txt
│   └── README.md
│
└── architecture.md
