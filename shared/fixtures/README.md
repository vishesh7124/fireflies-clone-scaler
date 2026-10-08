# shared/fixtures

Sample data authored **once**, consumed **twice**:

1. **Frontend mock layer** (`frontend/src/lib/mock/`) imports these files so the
   entire UI is fully interactive before the backend exists.
2. **Backend seeder** (`backend/app/seed/`) loads the *same files* to populate
   SQLite.

Shapes mirror the API payloads specified in `docs/03-LOW-LEVEL-DESIGN.md` §2.4
(one file per meeting: `meeting-01.json`, `meeting-02.json`, … plus
`meetings-index.json`).

> Authored in Phase 1 — currently empty.
