# 04 — Tech Stack & Libraries

> Everything we will install, with the **why** for each choice (evaluation interviews will ask). Versions = current stable at time of implementation; pin exact versions in `package.json` / `requirements.txt`.

---

## 1. Stack at a glance

| Layer | Technology |
|---|---|
| Frontend framework | **Next.js 15 (App Router) · React 19 · TypeScript (strict)** |
| Styling | **Tailwind CSS v4** (CSS-first `@theme` tokens) |
| UI primitives | **shadcn/ui** (Radix) — restyled to Fireflies dark tokens |
| Server state | **TanStack Query v5** |
| Client state | **Zustand v5** (player + notepad UI stores only) |
| Backend framework | **FastAPI** + **uvicorn** |
| ORM / DB | **SQLAlchemy 2.0** + **SQLite** (WAL) + **Alembic** migrations |
| Validation | **Pydantic v2** (+ `pydantic-settings`) |
| Search | **SQLite FTS5** (`porter unicode61`) |
| Fonts | **DM Sans** (headings) + **Inter** (body) — the real Notepad fonts, via `next/font` |

## 2. Frontend dependencies

| Library | Why |
|---|---|
| `next`, `react`, `react-dom` | Assignment-mandated framework; App Router = file-based routing, layouts, streaming |
| `typescript` (strict) | Type safety end-to-end; API types mirror Pydantic schemas |
| `tailwindcss` v4 | Utility styling at the speed this timeline needs; `@theme` holds the Fireflies token table from doc 01 |
| `shadcn/ui` (CLI-installed: `button, dialog, dropdown-menu, tabs, tooltip, avatar, badge, checkbox, select, popover, scroll-area, separator, skeleton, toast, switch, command`) | Accessible primitives (Radix under the hood) we fully own and restyle — matches real product's polished components; not a heavy 3rd-party kit |
| `lucide-react` | Icon set matching the real app's thin line icons |
| `@tanstack/react-query` v5 | Caching, pagination, background refetch, invalidation after mutations, optimistic updates |
| `zustand` | Minimal store for high-frequency player state (avoids re-render storms a Context would cause at 4 Hz) |
| `sonner` | Toasts (assignment explicitly lists notifications/toasts) |
| `date-fns` | `format(parseISO(date), "EEE, MMM d yyyy, h:mm a")` → real app's date lines |
| `next-themes` | Dark-first default + light-mode toggle (bonus) |
| `class-variance-authority` + `clsx` + `tailwind-merge` | Component variant patterns (shadcn convention) |
| `next/font` (DM Sans + Inter) | Self-hosted fonts, zero layout shift — and it's literally what Fireflies uses |

**Deliberately NOT added**: component kits (MUI/Chakra — would fight the custom Fireflies look), Redux (overkill), axios (fetch wrapper is enough), form libs (forms are few; controlled inputs suffice).

## 3. Backend dependencies

| Library | Why |
|---|---|
| `fastapi` | Assignment lists FastAPI/Django; FastAPI wins: async, dependency-injected DB sessions, automatic OpenAPI docs at `/docs` (free API documentation for the README) |
| `uvicorn[standard]` | ASGI server (Render start command) |
| `sqlalchemy` ≥ 2.0 | Declarative typed models = the schema, one source of truth; relations/cascades express the ERD |
| `alembic` | Migration history (baseline + future changes) — signals DB maturity for evaluation |
| `pydantic` ≥ 2 + `pydantic-settings` | Request/response validation; env config with defaults |
| `python-multipart` | Multipart uploads (transcript + media files) |
| `httpx` | LLM calls (OpenAI-compatible) for summary/chat engines — async, optional |
| `reportlab` | PDF export (pure-Python, no system deps) |
| `pytest` + `httpx` (test client) | API/engine/parser/export tests |

**Stdlib only for**: WAV synthesis (`wave`, `struct`, `math`), VTT/TXT parsing (`re`), FTS5 (built into SQLite).

## 4. Tooling & workflow

| Tool | Purpose |
|---|---|
| `ruff` | Lint + format backend (fast, zero-config) |
| `eslint` + `prettier` (Next defaults) | Frontend lint/format |
| `tsc --noEmit` | Type gate in CI |
| Git + GitHub | Public repo, conventional commits, `.gitignore` (`data/`, `.env`, `node_modules`, `__pycache__`, `.next`) |
| Vercel (frontend) + Render (backend) | Deployment targets from the assignment's suggested list |

## 5. Environment variables

**backend/.env**

```ini
FIREFLIES_DB_PATH=data/fireflies.db     # SQLite file
MEDIA_DIR=data/media                    # generated + uploaded media
SEED_ON_START=true                      # auto-seed empty DB (keeps hosted demo alive)
CORS_ORIGINS=http://localhost:3000,https://<vercel-app>.vercel.app
LLM_API_KEY=                            # optional: enables LLM summaries/chat
LLM_BASE_URL=https://api.openai.com/v1  # any OpenAI-compatible endpoint
LLM_MODEL=gpt-4o-mini                   # any cheap chat model
```

**frontend/.env**

```ini
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## 6. Version & runtime notes

- Node ≥ 20 LTS, Python ≥ 3.12 (matches Render/Vercel current runtimes)
- SQLite ≥ 3.35 on the host guarantees FTS5 + strict tables (verify in `/health`)
- Lockfiles committed (`package-lock.json`, pinned `requirements.txt` + optional `requirements-dev.txt`)
