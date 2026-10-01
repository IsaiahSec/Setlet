
# CSCI 4397 & 6397 Software Engineering and AI Final Project
# Setlet

A study-set creation and spaced-repetition review application inspired by Quizlet, built in fulfillment of the final project for UCA's CSCI 4397/6397 Software Engineering and AI.
## Documentation
- [PROPOSAL.md](https://github.com/IsaiahSec/Setlet/blob/8eaa2866b50ec2aae0e9a964731dc44e20a06687/PROPOSAL.md) - full project proposal: scope, features, specifications, requirements, MVP, and the team's AI Tools Agreement
- [architecture.md](https://github.com/IsaiahSec/Setlet/blob/562340f69bf5a8f14d7e0cade2f13041a73df4d0/architecture.md) - current architecture and project skeleton
- [AGENTS.md](https://github.com/IsaiahSec/Setlet/blob/8eaa2866b50ec2aae0e9a964731dc44e20a06687/AGENTS.md) - context and conventions for AI coding agents working in this repo
## Tech Stack
- **Frontend**: React (Vite)
- **Backend**: Python (Flask)
- **Database**: PostgreSQL, accessed via raw SQL (`psycopg2`, no ORM)
- **Testing**: Pytest (backend), Vitest + React Testing Library (frontend)
- **Deployment**: Vercel (frontend) + Render (backend/DB), with GitHub Actions running the test suite on every pull request

## Getting Started
Backend:

- `cd backend`
- `pip install -r requirements.txt`

Frontend:

- `cd frontend`
- `npm install`

See [architecture.md](https://github.com/IsaiahSec/Setlet/blob/562340f69bf5a8f14d7e0cade2f13041a73df4d0/architecture.md) for the current project structure
## Authors

- [@IsaiahSec](https://github.com/IsaiahSec)
- [@Tugba Agdas](https://github.com/tugbaagdas)