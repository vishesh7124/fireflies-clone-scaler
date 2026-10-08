# 00 — Project Overview

> **Fireflies.ai Clone — Meeting Notes & Transcription Platform**
> SDE Fullstack Assignment · Scaler AI Labs Hiring
> Design documentation set — review before implementation begins.

---

## 1. What we are building

A functional clone of the Fireflies.ai meeting-assistant web app that replicates its **design, UX, and core post-meeting workflows**:

- A meetings library ("Notebook") with search, filters, and sorting
- A meeting detail view ("Notepad") with an **interactive transcript** synced to a media player (click a line → player seeks; player plays → line highlights)
- AI-generated summaries: overview, bullet notes, action items, topics/chapters, metrics
- Full CRUD on meetings, transcripts, summaries, and action items (all persisted)
- The full Fireflies "experience": navigation, modals, toasts, filters, settings placeholders, AskFred AI chat

## 2. Hard constraints (from the assignment PDF)

| Constraint | Value |
|---|---|
| Frontend | **Next.js (TypeScript)** |
| Backend | **Python — FastAPI** (chosen over Django: lighter, async, cleaner for a REST API) |
| Database | **SQLite** — own schema design, will be evaluated |
| Real speech-to-text | **Out of scope** — seed / upload transcripts / optionally LLM-generate summaries |
| Auth | Mocked — assume one default logged-in user |
| Repo layout | `frontend/` + `backend/` in one public GitHub repo |
| Deliverables | Source code + README (setup, architecture, DB schema, API overview) + hosted demo |
| Effort | ~24 hours |

## 3. Scope matrix — build vs mock

The user directive: **"keep the mocking minimum, try to implement as much as possible."**

### Fully implemented (real functionality, persisted in SQLite)

| Feature | Notes |
|---|---|
| Meetings library / dashboard | List, search, filter (title/date/participant/tag), sort by recency/duration/title |
| Interactive transcript detail view | Speaker labels, timestamps, click-to-seek, player-to-line highlight, auto-scroll |
| Media player | Custom Fireflies-style player: seek bar, play/pause, skip ±5s, speed control (0.5–2×), volume |
| In-transcript search | Find bar with highlighted matches, match count, prev/next navigation |
| AI Summary & Notes | Overview, bullets, action items, topics/chapters (timestamped), metrics — rule-based engine + optional LLM |
| Action items | Add / edit / assign / complete / delete, aggregated Tasks page |
| Meeting CRUD | Create via transcript paste or file upload (.txt/.vtt/.json) or schedule form; edit metadata; delete |
| Transcript editing | Inline edit with autosave (matches real product) |
| Smart Search filters | Questions, Tasks, Dates, Metrics, Pricing, Sentiment, Filler words — rule-based classification of segments |
| Speaker analytics | Talk-time %, word count, avg words-per-minute per speaker |
| AskFred (meeting-scoped + global) | Q&A over transcript with timestamped citations — LLM if key present, retrieval fallback otherwise |
| Global search | Cross-meeting search over titles + transcript text (SQLite FTS5) |
| Tags | Tag meetings, filter by tag |
| Comments / Bookmarks / Soundbites | Timestamped, on transcript segments (bonus features implemented) |
| Export | TXT, Markdown, SRT, VTT, JSON, PDF |
| Notifications | Toasts for all mutations (create/edit/delete/complete/export) |
| Dark mode + light mode | Dark-first (the real app is dark); light theme as toggle |
| Seed data | 8 rich meetings with full transcripts, summaries, action items, tags, comments, chat history |
| Settings page | Functional persistence (theme, default summary template, playback speed) + placeholders |

### Mocked / placeholder (per assignment: a clean "Coming Soon" suffices)

| Feature | Treatment |
|---|---|
| Real-time bot joining live calls | Capture menu item → "Coming Soon" toast + roadmap modal |
| Speech-to-text | We accept transcript files/text; upload of audio generates a placeholder processing flow |
| Integrations (Zoom/Meet/CRM/Slack…) | Integrations page with grid of real logos + "Connect" buttons that show "Coming Soon" |
| Team / sharing & collaboration | Share button copies a read-only link (works) + "Team features coming soon" |
| Real authentication | Mock login screen replicating Fireflies' login; picks up the default user |

## 4. Evaluation criteria → design responses

| Criterion | How this design answers it |
|---|---|
| **Functionality** (interactive transcript, summaries) | Two-way player↔transcript sync algorithm; normalized summary schema; rule-based + LLM engines |
| **UI/UX** (visual similarity) | Dedicated UI research doc (01) → exact tokens, layout, component specs from real screenshots + official docs |
| **Database design** | 14 related tables + FTS5 index, ERD, rationale per table (03) |
| **Backend / API design** | Layered FastAPI (routers → services → repos), versioned REST, consistent envelopes, pagination (02/03) |
| **Code quality / modularity** | Strict separation: UI components / hooks / stores / api-client; routers / services / models |
| **Code understanding** | Every doc explains *why*; README will mirror this |

## 5. Product facts that inform the design (from the official demo video)

1. Notebook = all meetings, searchable, filterable; meeting pages have "overview, summary, bullet point notes, metrics, and timestamps"
2. Dedicated **action items section** with tasks assigned to participants
3. Full transcripts with speaker labels + timestamps; **clicking anywhere jumps to that moment**
4. Playback speed, download transcript/notes/video/audio in multiple formats
5. **AskFred**: "what were the key takeaways / when was pricing discussed?"
6. **Smart Search panel** filters: tasks, dates, questions, metrics, pricing, sentiment; **speaker talk time and pace (WPM)**; keyword trackers; clicking a filter jumps into the transcript
7. Global search / AskFred across all meetings with source attribution

---

## 6. Decision log (locked with user — Oct 9, 2026)

| # | Decision | Choice |
|---|---|---|
| 1 | AI summaries & AskFred | **Both**: rule-based engines (default, zero-setup, works offline) + optional LLM via `LLM_API_KEY` env — engines swap at runtime |
| 2 | Deployment | **Decide at Phase 8** — docs assume Vercel (frontend) + Render (backend) as the default plan; SQLite auto-seeds on startup either way |
| 3 | Bonus scope | **All bonuses**: comments/bookmarks/soundbites, exports (TXT/MD/SRT/VTT/JSON/PDF), global search, tags, AskFred chat, dark + light mode |
| 4 | Build order (Oct 9) | **Frontend-first**: complete UI against a stateful mock layer (localStorage-persisted, contract-shaped fixtures in `shared/fixtures/`), then backend to the frozen contract, then integrate & ping-pong. See `05-ROADMAP.md` |

---

## 7. Documentation map

| File | Contents |
|---|---|
| `00-PROJECT-OVERVIEW.md` | This file — scope, constraints, feature matrix |
| `01-UIUX-RESEARCH.md` | Fireflies design study: brand, tokens, screen-by-screen specs, component inventory |
| `02-HIGH-LEVEL-DESIGN.md` | System architecture, component layers, data flows, deployment |
| `03-LOW-LEVEL-DESIGN.md` | Database schema (DDL + ERD), full API reference, frontend components, key algorithms |
| `04-TECH-STACK-AND-LIBRARIES.md` | Every library with version + justification |
| `05-ROADMAP.md` | 8-phase implementation plan (~24h), risks, demo script |
