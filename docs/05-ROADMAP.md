# 05 — Implementation Roadmap (Frontend-First)

> **Strategy (agreed with user):** build the complete frontend UI against a stateful **mock data layer** first — establishing the visual/UX base for review — then implement the backend to the frozen API contract, integrate, and ping-pong between both until done. ~24 hours total.
>
> Why this works: the API contract (`docs/03` §2) is fully specified up front, so the frontend codes against typed mocks; swapping to the real FastAPI backend later is **one env flag** (`NEXT_PUBLIC_USE_MOCKS=false`) — zero component changes. Sample content is authored once as shared JSON fixtures, consumed by both the mock layer and the backend seeder.

---

## Phase map (frontend → backend → integrate)

| Phase | Deliverable | Est. | Checkpoint (demoable) |
|---|---|---|---|
| 0 | Scaffold + design tokens + app shell | 1.5h | Dark app shell renders |
| 1 | Shared fixtures + mock data layer | 2h | All planned screens have real-looking data available |
| 2 | Login, Home, Meetings library | 3.5h | Browse/filter/search/create/delete — full UX, mocked |
| 3 | **Notepad UI** (core screen) | 5h | Interactive transcript ↔ player sync, summary, smart search |
| 4 | Tasks, AskFred, Settings, Integrations | 2h | Every app page live (mocked) |
| — | ★ **Visual review checkpoint with user** | — | *Base established — course-correct before backend* |
| 5 | Backend foundation: models, migrations, seeder, core APIs | 3h | Contract implemented; curl roundtrips work |
| 6 | Smart backend: engines, FTS search, chat, uploads, exports | 3.5h | Upload .vtt → processed meeting; search; AskFred |
| 7 | **Integration** + bonus wiring | 2.5h | Real API behind the full UI; bonuses live |
| 8 | Tests, README, deploy, QA | 2h | Hosted demo + public repo |
| — | Buffer | 1h | — |

---

## Phase 0 — Scaffold + design system (1.5h) — ✅ done (Oct 9)

- [x] Git init; `frontend/` + `backend/` + `shared/fixtures/` + `docs/` + README stub + `.gitignore`s
- [x] `create-next-app` (TS strict, App Router, Tailwind v4); FastAPI placeholder `main.py` with `/health`
- [x] `@theme` tokens from doc 01 §3 (colors, radius); DM Sans + Inter via `next/font`; global dark styles
- [x] shadcn/ui init + primitives (Radix base, Nova preset — 20 components); restyled to Fireflies dark tokens
- [x] `AppShell`: `Sidebar` (nav + active pill + bottom items), `Topbar` (search box, chips, Upgrade, bell, `CaptureMenu`) + placeholder pages for every nav route + placeholder Home (hero + Quick Start tiles)
- **Checkpoint:** build green (12 routes); prerendered HTML verified against shell markers. Next.js 16.4 / React 19 / lucide-react 1.x (`*Icon` import convention).
- **Review round 1 (Oct 9, `original.png` vs `clone.png`):** applied — warm plum palette (`#0E0A17` canvas / `#251C3D` accents / mint `#3DDC97`), sidebar 240px w/ 15px nav + plum active pill + green-text `40% OFF`, topbar (real search copy, `Ctrl`+`K` keycaps, red bell dot, camera-icon Capture), centered 880px content column, hero (plum fill + visible border + richer thumbnail), one-line Quick Start tiles, Recent/Upcoming/AI Feed tabs + recent row, Try More cards, trial banner, floating promo card, help bubble, ambient canvas glow.
- **Review round 2 (Oct 9):** corrected round 1's over-purple — **neutral dark-gray base** (`#141314` canvas / `#1E1E1F` sidebar), purple as accent only (`#6938EF` buttons, `#8B7CFF` links), **warm brown/copper hero** (`#3A1F0F→#5A2D12` + copper laptop mockup), **solid tinted Quick Start tiles** (maroon/teal/indigo), muted forest greens (Upgrade pill / 3 badge / 40% OFF pill), neutral grays for text (`#B8B8BC` / `#9A9A9E`), **smaller radii** (pills 4 · controls 6 · cards 12), lavender help bubble, promo card moved into sidebar bottom ("Invite coworkers" + Create Team), "Try Email Assistant" purple-highlighted, sidebar group separator, initials workspace avatar.

## Phase 1 — Shared fixtures + mock layer (2h) — ✅ done (Oct 9)

- [x] `shared/fixtures/`: 10 meetings as compact JSON (8 ready w/ full transcripts 47–80 lines each + structured summaries/action items w/ provenance/tags; comments+bookmarks+soundbites on meetings 2/4/5/8; chat threads on 2 & 5; 2 upcoming `scheduled`) — format spec in `shared/fixtures/README.md`
- [x] `lib/types.ts` — full contract types + `ApiClient` interface (frozen; backend Pydantic mirrors in Phase 5)
- [x] `lib/api.ts` adapter (`NEXT_PUBLIC_USE_MOCKS` flag) + `lib/http-api.ts` (real FastAPI paths, wired in Phase 7)
- [x] `mock/` layer: `load.ts` (fixture parser → normalized db), `engine.ts` (smart-search classification, stats/WPM/sentiment, rules-based summary generation, AskFred retrieval w/ citations, txt/md/srt/vtt/json exports), `store.ts` (localStorage persistence + processing→ready simulation), `api.ts` (contract impl w/ latency)
- [x] React Query provider mounted in `(app)/layout.tsx`; `npm run smoke` — end-to-end data-layer test, all green
- **Checkpoint:** `npm run smoke` prints the full roundtrip (list/filters, transcript/stats, summary, AskFred w/ citations, create→process→ready, action-item toggle, 5 exports, engagement CRUD).

## Phase 2 — Login, Home, Meetings library (3.5h)

- [ ] React Query + toast + theme providers; `mockApi` wired
- [ ] `/login` replica (mock auth → localStorage flag → redirect)
- [ ] `/` Home: welcome hero, Quick Start tiles → real modals, Recent/Upcoming/AI Feed tabs, dashboard stats, meeting rows
- [ ] `/meetings`: ChannelsRail, toolbar (tabs, FiltersDropdown, sort), MeetingRow (thumb, title, date, participant stack, duration, tags, 3-dot), pagination, empty state, skeletons
- [ ] Create flows: Upload modal (file/drag-drop + paste + optional media), Schedule modal → `scheduled` meeting (shows under Upcoming); delete w/ confirm + toast; rename via 3-dot
- **Checkpoint:** full library UX works end-to-end on mocks; **this is where the "Fireflies look" verdict happens.**

## Phase 3 — Notepad UI ★ (5h)

- [ ] `NotepadHeader` (back, inline rename, participants, 3-dot menu, ExportMenu)
- [ ] `MediaPlayer`: custom seek bar, play/pause, ±5s, speed 0.5–2×, volume, time display — **virtual clock engine** (`useAudioPlayer` rAF fallback; `<audio>` path ready for Phase 7)
- [ ] `TranscriptView` + memoized `TranscriptLine` + active-line highlight + auto-scroll (doc 03 §5.1)
- [ ] `FindInTranscript`: `<mark>` highlights, count, prev/next, filter-to-matches
- [ ] Edit mode: contenteditable + debounced autosave (mock store) + optimistic state
- [ ] `SummaryPanel`: Overview/Action items/Notes/Topics/Metrics; template dropdown; Copy/Reprocess/Edit toolbar; topics & metrics anchor → seek
- [ ] `ActionItemsSection`: checkbox (optimistic), assignee, due badge, inline add/edit/delete
- [ ] IconRail + `SmartSearchPanel` (rule-based client-side classification per doc 03 §5.2 — counts + jump + highlight; speaker talk-time bars + WPM) + `IndexPanel`
- [ ] Resizable `SplitLayout` + expand/full-screen; collapsible rail (persisted)
- **Checkpoint:** the assignment's core feature demonstrable — click line → seek; play → highlight & scroll — even before the backend exists.

## Phase 4 — Remaining app pages (2h)

- [ ] `/tasks`: segmented My/All, grouped rows, provenance link (opens Notepad + seeks), New dialog, integration banner
- [ ] `/askfred`: chat rail, composer, suggestions, citation chips (mock rule-based answers per doc 03 §5.4)
- [ ] Notepad `AskFredPanel` (meeting-scoped) + `SoundbitesPanel`/`CommentsPanel`/`BookmarksPanel` (mock-backed)
- [ ] `/settings` (localStorage-persisted) + `/integrations` (Coming Soon grid + toasts)
- [ ] Toast audit: every mutation notifies; delete confirms
- **★ Visual review checkpoint:** walk the app with the user against the original screenshots; collect change requests before a line of backend is written.

## Phase 5 — Backend foundation (3h)

- [ ] `models/` (14 tables per doc 03 §1.3), `database.py` (WAL), Alembic baseline
- [ ] `seed/`: loads **`shared/fixtures/`** (the same JSON the mock layer used — single source of truth) + `media_synth` WAV generation
- [ ] Core routers to the frozen contract: meetings (list w/ all filters + pagination), create (JSON/multipart → `processing` → BackgroundTask), detail, patch, delete/restore, transcript, segment edit, participants, summary (+manual item CRUD), action items CRUD, `/me`, `/settings`, `/dashboard`, `/health`
- [ ] Contract verification: response shapes validated against `lib/types.ts` (a tiny script or manual diff)
- **Checkpoint:** every endpoint the frontend already calls returns contract-correct data from SQLite.

## Phase 6 — Smart backend (3.5h)

- [ ] `parsers` (.vtt/.json/.txt/raw) + tests
- [ ] `summary_engine` (rules + LLM branch) + action-item extraction w/ provenance + topic chapters + templates
- [ ] `search_service` (FTS5 + snippets + grouping, LIKE fallback); `chat_engine` (intents + retrieval + citations; LLM branch)
- [ ] `stats_service` (talk-time, WPM, sentiment, filter counts)
- [ ] `export_service` (txt/md/srt/vtt/json/pdf)
- **Checkpoint:** upload a real .vtt → meeting `ready` with generated summary/action items; AskFred answers with citations.

## Phase 7 — Integration + bonus wiring (2.5h)

- [ ] Flip `NEXT_PUBLIC_USE_MOCKS=false` → full app on real API; delete/flag-off mock store
- [ ] Fix integration gaps (the ping-pong phase: field tweaks on either side as discovered)
- [ ] Real `<audio>` playback path (generated WAVs + uploads); speed/seek still synced
- [ ] Bonus wiring end-to-end: tags CRUD + filters, comments/bookmarks/soundbites persistence, export downloads, global ⌘K search, light-mode toggle
- **Checkpoint:** the complete app runs on FastAPI + SQLite — everything persists for real.

## Phase 8 — Ship (2h)

- [ ] Backend pytest suite (API roundtrip, parsers, engines, export, FTS)
- [ ] README: setup (2 commands), architecture, DB schema (ERD + table doc), API overview, assumptions, screenshots
- [ ] Deploy (target picked at this point — default plan Vercel + Render w/ auto-seed); hosted QA pass on demo script; public repo check (clean history, no secrets)
- **Checkpoint:** submission links ready.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Mock drift from real contract | Contract frozen in `docs/03` + `lib/types.ts`; Phase 5 validates backend responses against it |
| Transcript sync jank on long meetings | Memoized lines + binary search + `block:'nearest'` scroll; React Profiler check in Phase 3 |
| Pixel-perfect drift from Fireflies look | Tokens centralised in one `@theme`; side-by-side with screenshots at each phase; user review at Phase 4 |
| LocalStorage mock state feels "fake" | It's explicitly a scaffold: same UX flows, swapped for SQLite in Phase 7 |
| Render free tier resets disk | Idempotent auto-seed on startup — demo self-heals (noted in README assumptions) |
| LLM key absent at eval time | Rule-based engines are the default path — full experience works offline |
| 24h overrun | Core = Phases 0–3, 5, 7–8; Phases 4/6 can compress; bonus depth is the shock absorber |

## Final demo script (3 minutes — mirrors evaluation criteria)

1. **Login** → dark app, "Welcome aboard, VISHESH!"
2. **Meetings library**: search "pricing", filter by participant, sort by recency — rows with participants/duration/tags
3. **Open Sales Discovery Call**: play → lines highlight & auto-scroll; click a line → player jumps; speed 1.5×
4. **Find in transcript**: "budget" → highlights, count, next/prev
5. **Smart Search**: `Questions 8 · Tasks 6 · Metrics 3 · Pricing 2` chips → jump into transcript; speaker talk-time bars
6. **Summary panel**: overview, action items (tick one → persists + toast), topics chapter click → seeks player; Regenerate
7. **AskFred**: "When was pricing discussed?" → answer with citations → click citation → player seeks
8. **Create meeting**: paste transcript text → processing → ready with generated summary/action items
9. **Tasks page**: cross-meeting list; open provenance link → Notepad seeks to source line
10. **Global ⌘K search** → transcript match across meetings → jump; **Export** markdown; **Settings** persist; light-mode toggle
