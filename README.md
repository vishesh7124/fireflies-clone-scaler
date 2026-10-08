# Fireflies.ai Clone — Meeting Notes & Transcription Platform

> SDE Fullstack assignment (Scaler AI Labs): a functional clone of Fireflies.ai —
> meetings library, interactive transcripts synced to a media player, AI summaries,
> action items, AskFred chat, and the full Fireflies workspace experience.

**Status: Phase 0 — scaffolding.** (Full setup docs, architecture overview and DB
schema land in Phase 8 — see the phase plan in `docs/05-ROADMAP.md`.)

## Repository layout

```
frontend/          # Next.js 15 (App Router, TypeScript, Tailwind v4)
backend/           # FastAPI (Python) — REST API + SQLite
shared/fixtures/   # sample data authored once, used by frontend mocks AND backend seeder
docs/              # design system, HLD, LLD (DB schema + API spec), tech stack, roadmap
```

## Quick start (local)

**Frontend** — http://localhost:3000

```bash
cd frontend
npm install
npm run dev
```

**Backend** — http://localhost:8000 (API docs at `/docs`)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Documentation

| Doc | Contents |
|---|---|
| `docs/00-PROJECT-OVERVIEW.md` | Scope, decisions, feature matrix |
| `docs/01-UIUX-RESEARCH.md` | Fireflies design study — tokens, layout, screen specs |
| `docs/02-HIGH-LEVEL-DESIGN.md` | Architecture, data flows, deployment |
| `docs/03-LOW-LEVEL-DESIGN.md` | DB schema (DDL + ERD), full API reference, algorithms |
| `docs/04-TECH-STACK-AND-LIBRARIES.md` | Stack + every dependency, justified |
| `docs/05-ROADMAP.md` | Frontend-first phase plan (~24h) |
