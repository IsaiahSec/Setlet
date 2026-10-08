# AGENTS.md

Instructions for AI coding agents (e.g. GitHub Copilot coding agent) working in this repository.

## Project

Setlet — a study-set/flashcard web app (Quizlet-style), built for CSCI 4397/6397 Software Engineering and AI at UCA.

Full requirements: see `PROPOSAL.md` (repo root) — Sections II (Scope, Features, Specifications, Requirements, MVP) and III (AI Tools Agreement) are most relevant to any assigned task. Current architecture and file structure: see `architecture.md` (repo root).

## Setup

Backend (Python/Flask):
```
cd backend
pip install -r requirements.txt
```

Frontend (React/Vite):
```
cd frontend
npm install
```

## Build, test, and validate

Backend tests, with the required coverage gate:
```
cd backend
pytest --cov=src --cov-report=term-missing --cov-fail-under=80
```
- `backend/src` must stay at or above 80% coverage.
- `# pragma: no cover` is only acceptable on genuinely unimplemented placeholder code (e.g. an intentionally stubbed function), never to work around missing tests for real logic. Include a short comment explaining why when used.

Frontend tests (Vitest + React Testing Library):
```
cd frontend
npm test
```
- No coverage threshold is required on the frontend yet — at least one real, passing smoke test per new page/component is sufficient for now.

## Scope and conventions

- Stay scoped to the assigned Issue. Do not modify files unrelated to the task (e.g. a backend task should not touch `frontend/`, and vice versa).
- Until the MVP is built, open pull requests into `mvp`. A maintainer opens the single `mvp` -> `main` pull request. Reference issues as `Refs #N`, not `Closes #N`.
- Squash merge only.
- One teammate approval is required before merge, plus passing status checks (`backend-tests`, `frontend-tests`).
- Follow existing naming and structure conventions already established in `backend/src/` and `frontend/src/` (see `architecture.md` Section 6 for the current file tree) rather than introducing a new pattern.
- If a task's acceptance criteria include updating `architecture.md` or another doc, treat that as part of the task, not optional.
- Issues are grouped under feature parents, and titles start with an ID like [F2-BE1]. Before starting, read the assigned issue's parent issue (up to the root parent) and any other issues with the same prefix (e.g., [F2-*]) for context on how the pieces fit together. If you can't open them, proceed with the assigned issue alone.
- Use that context only to stay consistent (e.g., names, endpoints, schema). Implement only what the assigned issue requires. If a sibling issue contradicts the assigned one, the assigned issue wins and you should not the conflict in the PR description.
## Notes

- Database access uses raw SQL via `psycopg2` — no ORM.
- Authentication uses bcrypt-hashed passwords and a bearer token (`Authorization: Bearer <token>`) returned on login, not a session cookie — frontend and backend are deployed on separate origins (Vercel / Render), which makes cross-site cookies impractical.
