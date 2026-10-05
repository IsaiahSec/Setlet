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

### Initial Pages

The frontend skeleton currently includes placeholders for:

- `Login.jsx` - user login
- `Signup.jsx` - user registration
- `MySets.jsx` - user's study sets
- `PublicSets.jsx` - publicly available study sets
- `SetEditor.jsx` - creation and editing of study sets and cards
- `StudyReview.jsx` - studying and reviewing a set

These files establish the planned frontend organization and do not represent completed features.

### Service Layer

`services/api.js` is reserved for communication between the frontend and the backend API. This keeps API communication separate from page and UI components.

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

These directories are currently empty aside from placeholder `__init__.py` files and do not represent completed features, matching the frontend skeleton's scope.

### API

MVP endpoints (`auth`, `sets`, `cards`, `reviews`) will be built first, matching the MVP scope in the project proposal and the frontend's initial page set. Feedback (GitHub API integration) and Notes/Derivation are proposal features but are explicitly excluded from MVP per the project proposal's MVP section, so their routes and services will be added after the MVP milestone, not as part of this skeleton. A `/health` endpoint currently exists as a placeholder to confirm the Flask app runs.

---

## 3. Database

### Technology

PostgreSQL, hosted on Render alongside the backend, accessed via `psycopg2` rather than an ORM.

### Initial Data Model

MVP tables, per the project proposal: `users`, `study_sets`, `cards`, `review_state`, `review_logs`. Two additional tables — `feedback_limits` and `notes` — are part of the full proposal scope but support post-MVP features, so their schemas will be implemented after the MVP milestone. `db.py` connects using the `DATABASE_URL` environment variable and creates tables on startup if they do not exist. Currently implemented:

- `users` - `id` (serial primary key), `email` (unique), `password_hash` (bcrypt), `created_at`

Schema definitions for the remaining MVP tables will be added as the data layer is built out.

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
│   │   │   └── auth.py
│   │   ├── services/
│   │   │   └── auth.py
│   │   ├── models/
│   │   │   └── users.py
│   │   ├── app.py
│   │   └── db.py
│   ├── tests/
│   ├── requirements.txt
│   └── README.md
│
└── architecture.md
