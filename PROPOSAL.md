# Setlet — Final Project Proposal

**Team Works On My Machine:** Isaiah Stewart, Tugba Agdas
**Advisor:** Dr. Baarsch
**Course:** CSCI 4397/6397 Software Engineering and AI, Fall 2026

## I. Overview

A web application that functions as a study assistant and notes organizer, loosely aimed at being a Quizlet alternative.

## II. Project Scope, Features, Specifications, Requirements, and MVP

### A. Scope

This project will produce a web application that enables users to create, organize, share study sets (question/answer or term/definition pairs), and provide feedback on the application. The scope of this project is centered around its function as a study tool, and will include: account creation and authentication, study set authoring, storing uploaded notes and optionally deriving study sets from them, set visibility, browsing and filtering for personal and global set views, and study and review tools.

### B. Features

1. **Accounts & Ownership** — Sign-up and login; every set belongs to a user
2. **Study Set Authoring** — Creating, editing, and deleting sets; add, edit, reorder, and delete individual cards within a set
3. **Visibility Control** — Toggle a set between private (owner only) and public (discoverable by any user)
4. **Browsing & Filtering** — Searching personal sets and public sets through a personal view or global view, respectively, and filtering sets by title, keywords, owner, or date shared
5. **Study/Review Mode** — A study mode with Quizlet-style term and definition flipping UI, a spaced-repetition review mode with scheduling based on recall performance, both optionally engaged with on individual sets
6. **Review History** — Per-user statistics on sets studied, cards reviewed, and upcoming review load
7. **Recents** — Up to 4 recently viewed sets (public or private) that take the user to that set
8. **App Feedback** — Non-blacklisted users can submit feedback (bug reports, suggestions), limited to one submission per hour per user, about the application; submissions are automatically filed as GitHub Issues in the team repository (labeled `user-feedback`) for developer triage
9. **Note Storage & Derivation** — Users can upload and store personal notes; notes can optionally be parsed to generate a corresponding study set, which the user reviews and edits before they are saved to a set

### C. Specifications

1. **Frontend:** React (via Vite)
2. **Backend:** Python (Flask)
3. **Database:** PostgreSQL, accessed via raw SQL (psycopg2), with tables for `users`, `study_sets`, `cards`, `review_state`, `review_logs`
4. **Testing:** Pytest
5. **Authentication:** email/password with hashed credentials (bcrypt)
6. **Deployment:** Vercel (frontend) + Render (backend/DB), with GitHub Actions running the test suite and auto-deployment on merge to `main`
7. **Visibility Field:** `study_sets.visibility` enum (`private`/`public`), enforced at the query layer so private sets never appear in public list/search endpoints
8. **Feedback Integration:** GitHub REST API authenticated via a repo-scoped personal access token stored as a Render environment variable; rate-limiting and blacklist state tracked in a `feedback_limits` table
9. **Note Storage:** `notes` table (`id`, `user_id`, `title`, `body`, `created_at`)
10. **Derivation Method:** Local heuristic pattern-matching (e.g., `Term: Definition` and `Term - Definition` line formats) — no external API calls or trained model involved

### D. Requirements

#### 1. Functional

a) A user can only edit or delete their own sets and cards
b) A public set is readable (but not editable) by any authenticated user
c) Search/browse of public sets must exclude all private sets
d) Review scheduling must persist per user, per-card — two users studying the same public set have independent progress
e) Recently viewed sets should be ordered by last viewed, with the most recently viewed set at the top, and should persist and update per user
f) Every card belongs to exactly one set; a set can have zero or more cards
g) A user cannot submit feedback more than once per hour; the one-hour window is measured from their last successful submission, not their last attempt
h) Blacklist status is managed directly by the development team via database access; no in-app admin interface is required for the MVP
i) A failed GitHub API call does not update the user's `last_submitted_at`, allowing the user to retry without consuming their usage for the hour
j) A blacklisted user's feedback submission is silently discarded (not filed as a GitHub Issue), while the user receives the same courtesy confirmation a non-blacklisted user would see, with no indication that they are blacklisted
k) A blacklisted or non-blacklisted user that is rate-limited receives an informative message stating that they are only allowed to submit feedback once per hour
l) A user can only view, edit, or delete their own notes
m) Derived cards are not saved to a set automatically — the user must review and confirm each card before it is saved; a note that produces zero cards does not block manual card creation

#### 2. Non-functional

a) Test coverage > 80% on core logic (visibility enforcement and review scheduling are the highest priority test targets, since a visibility bug is a privacy failure)
b) API responses must never leak another user's private set data
c) CI pipeline runs on every pull request; merges blocked until tests pass and another team member has reviewed and approved

### E. MVP

1. Signup/login
2. Creation of study sets, adding/editing/deleting cards within it
3. Set a study set to private or public
4. Browse/search public sets created by other users
5. Run a review session on a study set and have progress persist between sessions

## III. Agreement on AI Tools and Standards

The team will follow the development workflows assigned to each cohort while working within the same shared GitHub repository. All changes created or proposed will be reviewed before being accepted or merged, and development activities will be documented to maintain the required audit logs.

### A. Cohort A — IDE Native Agentic Workflow (Tugba Agdas)

1. **Project Context** — Relevant project files will be opened in the development environment to provide the necessary context.
2. **Development** — IDE-native tools will be used to create and modify code, develop assigned features, and assist with implementation.
3. **Branch Development** — Changes will be developed on a separate branch, including code changes and tests where necessary.
4. **Review** — Suggested changes and visual diffs will be reviewed before being accepted.
5. **Testing and Debugging** — The application will be tested locally, and development tools will be used to identify and resolve bugs.
6. **Pull Request** — Completed changes will be submitted via a Pull Request for review.
7. **Refinement** — When necessary, additional guidance will be provided based on review feedback to correct, refine, or further improve the application.
8. **Merge** — Approved changes will be merged into the main branch following review and testing.
9. **Audit Log** — Tool interactions and development activities will be documented as required.

### B. Cohort C — Ecosystem Integrated Workflow (Isaiah Stewart)

1. **Task Specification** — Development tasks and feature requirements will be defined via GitHub Issues.
2. **Development** — Tools integrated with GitHub will be used to work on selected issues and project features.
3. **Branch Development** — Changes will be developed on separate branches, including code changes and tests where necessary.
4. **Pull Requests** — Completed changes will be submitted via Pull Requests for review.
5. **Review and Testing** — Code changes and test results will be reviewed before approval.
6. **Revision** — Additional instructions or comments will be provided when revisions or improvements are needed.
7. **Merge** — Approved changes will be merged into the main branch following review and testing.
8. **Audit Log** — Issues, pull requests, tool interactions, and development activities will be documented as required.

Each team member will collaborate on the same GitHub repository by following the cohort workflows assigned them. The code will be reviewed and tested before being committed or merged. The team will maintain a consistent project structure and coding practices and will document tool-assisted development activities throughout the project.

## IV. GitHub Repository

[https://github.com/IsaiahSec/Setlet](https://github.com/IsaiahSec/Setlet)
