# Assignment audit — before LLM integration

Audit date: October 9, 2026. Scope: assignment compliance, current source,
design/documentation artifacts, saved reference/clone screenshots, and available
checks. Hosting setup is explicitly outside this audit. No application changes
were made during the audit.

## Verdict

The required stack and the main post-meeting experience are present. However,
the project is **not yet complete against every must-have**: participant editing,
task editing, and date-filter controls are missing. Several existing workflows
need reliability fixes before adding an LLM. Seeded/rule-generated summaries and
placeholder media are explicitly allowed by the assignment; real transcription,
authentication, integrations, and collaboration are not required.

## Evidence and verification limits

- Read `Scaler_SDE_Fullstack_Assignment_-_Fireflies_Clone.pdf`, README, design
  overview, UI research, HLD, LLD schema sections, stack document, and roadmap.
- Reviewed core frontend/backend flows, schemas, ORM relationships, API adapter,
  search, summaries, tasks, transcript synchronization, chat, and test scripts.
- Visually inspected all eleven root PNGs: `original.png`, `meetings.png`,
  `upload.png`, `notepad1.png` through `notepad4.png`, and four clone screenshots.
- Saved clone images are historical: they show layouts subsequently replaced in
  source. They are not proof of the current rendered UI. Original screenshots
  remain useful references. No fresh browser screenshots were captured.
- UI research refers to 30 screenshots in `fireflies_ui_ss/`; those are not in
  the current workspace. No saved Tasks reference or original modal-dialog
  reference was available in the root screenshot set.
- `npm run build`: passes compilation and TypeScript checks.
- `npm run lint`: fails with **4 errors and 27 warnings**.
- `python tests/test_parse.py`: runs successfully, including fractional and
  hour-format examples, but most cases only print output rather than assert it.
- A direct rule-engine check reproduces `KeyError: 'end_ms'` for a duration
  question using the segment shape supplied by the chat router.
- Did not execute `backend/tests/smoke.py`: it wipes and reseeds the configured
  database. No live or local user records were modified by this audit.

## Must-have coverage

### Visual pass implemented (awaiting user review)

Fresh baseline and updated Chromium screenshots now exist under
`docs/screenshots/`. Reference-based panel, navigation, AskFred, Home, upload,
transcript and dialog adjustments were verified in the browser, including a
1440px Notepad capture. See `docs/07-VISUAL-PARITY-REVIEW.md` for dimensions,
evidence links, checked interactions, and honest remaining parity limits.

### Reliability pass implemented (awaiting user review)

- Global search remains mounted so Ctrl/Cmd+K works while closed. The installed
  cmdk primitive now supplies arrow-key selection and Enter-to-open behavior.
  Failed search requests have Retry rather than a misleading No results state.
- Search snippets escape backend content and render text/mark React nodes on the
  frontend, removing raw HTML rendering of uploaded transcripts.
- Transcript search has one query state, clears conflicting filters, exposes all
  searchable turns, and pauses audio-follow while browsing matches. Escape clears
  input and highlights; Sync with audio resumes follow. Selecting a smart filter
  clears the find query. Counts refer to matching turns rather than occurrences.
- Library, Tasks, and Notepad now show explicit load errors and Retry; missing
  meetings show a Back to meetings state. End-of-list copy appears only on the
  final results page. Cached timestamp navigation restores duration after reset.
- `/tags` and meeting tag assignment routes now match the HTTP client contract,
  restoring the existing tag-filter dropdown in real API mode.
- Chat GET retains stored citations. Router supplies ordered segments with end
  times and meeting titles plus action context for global questions. Provenance
  selection and multi-meeting duration aggregation are corrected.
- All four frontend lint errors and unused-import warnings were fixed. Full
  `npm run lint` is clean; `npm run build` passes. Temporary-DB regression suite
  now has ten passing tests, including citation history, safe search, and tags.
- Browser interaction/visual verification remains pending; no new screenshot
  parity claims are made here. LLM integration has not started.

### Core-completeness pass implemented (awaiting user review)

- Existing meeting menus now open a shared title/participant editor. Detail
  responses include participant IDs, email, host flags, and speaker statistics.
  Participant renames preserve IDs; removals clear transcript/task associations.
- Tasks and Notepad share an editor for description, assignment, and due date;
  explicit null can clear assignment/date. New task creation supports assignment.
- Filters include inclusive From/To dates; sort changes reset pagination.
- Transcript import infers participants from speaker names, rejects unparseable
  nonempty transcripts, and transcript edits refresh word-count statistics.
- Startup seeds only new workspaces. Explicit reseeding remains destructive;
  its database reload now commits once rather than committing the wipe early.
- Regeneration updates summary text only and preserves all independently managed
  tasks, including completion and edits, without appending duplicates.
- `python tests/test_core.py`: seven passing isolated temporary-database tests.
  `npm run build`: passes. Targeted lint has no errors; the remaining pre-existing
  project-wide lint errors are reserved for the reliability pass.
- No browser automation was installed in this environment, so new dialogs still
  require rendered visual/user review. Existing layout and design tokens remain.
- The findings table below records the pre-fix audit baseline, not a claim that
  these implemented fixes have already been accepted or deployed.

| Requirement | Current assessment | Needed improvement |
|---|---|---|
| Next.js/TypeScript, Python FastAPI, SQLite | Present | Retain stack |
| Library with title/date/duration/participants | Mostly present | Rows show first participant as host; expose full participant list in compact details/popover |
| Title/date/participant search and filters | Partial | Backend accepts date range, but Filters UI has no date controls |
| Sort by recency | Present | Reset pagination when sort changes; distinguish past library from upcoming meetings |
| Navigation/profile/settings placeholders | Present | No real auth work needed |
| Speaker/timestamp transcript and seek bar | Present in source | Regression-test real media and virtual-clock paths |
| Two-way player/transcript sync | Present in source | Test cached navigation and timestamp deep links |
| Transcript search/highlights | Partial reliability | Resolve hidden matches and playback/search scrolling conflicts |
| Summary/action items/topics | Present | Make regeneration repeat-safe without resetting user task changes |
| Create/paste/upload transcript | Present | Infer speakers and reject malformed/empty parsed transcripts |
| Edit title and participants | Partial | Title works; participant update is absent from backend request schema/router |
| Delete meeting | Present | Verify cascades in isolated tests |
| Add/edit/complete tasks | Partial | Add/complete/delete exist; description editing has no UI; Assign is a placeholder |
| All core records persist | SQLite writes present, startup risk | Default startup seeding wipes records; seed only an empty database |
| Fireflies visual/interaction fidelity | Substantial groundwork | Targeted proportional, panel, state, and modal refinement rather than redesign |

## Priority 1 — complete and stabilize core workflows

1. **Participant editing and complete detail responses.**
   `backend/app/schemas.py` lacks participants in `UpdateMeetingInput`.
   `routers/meetings.py::_meeting_detail` reuses list participant summaries,
   omitting IDs/email/stats expected by frontend `Participant` objects. Add a
   compact Edit meeting dialog in the existing overflow menu, preserve participant
   IDs when renaming, and return detailed participants on the detail endpoint.

2. **Task editing and assignment.**
   Both Tasks and Notepad expose add/complete/delete, but no description editor.
   Tasks' Assign button only shows a Coming Soon toast. Reuse one small task
   editor for description, assignee, and due date. Backend PATCH cannot currently
   clear an assignee or due date with explicit null; distinguish omitted fields
   from null. Keep source navigation separate from editing.

3. **Date filtering.**
   Add From/To controls inside `meetings-filters.tsx`, forward them through list
   parameters, include them in active filter counts and Clear All. Treat To as
   inclusive of the selected day. Validate invalid/inverted dates as 422 errors,
   not uncaught `datetime.fromisoformat` exceptions.

4. **Persistence across application restarts.**
   `main.py` calls `seed_all()` whenever `seed_on_start` is true; `seed_all()`
   deletes all records. This violates the persistence intent irrespective of
   hosting. Separate first-run seeding from explicit destructive reset. Retain
   existing user data on ordinary starts. Use a single seed transaction so a
   failed fixture load cannot leave a partially wiped database.

5. **Repeat-safe summary regeneration.**
   `routers/summaries.py` appends newly extracted action items on every regenerate.
   Avoid duplicates and preserve completed/manual/edited tasks. Define whether
   regeneration replaces only generated summary text or offers task suggestions.

6. **Speaker inference on import.**
   Create participants found in parsed transcript content; currently unmatched
   speaker names become null IDs and render as Unknown. Recompute statistics
   after transcript edits, not only at creation.

7. **Reliable transcript find navigation.**
   FindBar counts all segments, whereas TranscriptView can hide segments behind
   a smart filter. A reported match can therefore have no rendered scroll target.
   Search should either clear the filter or count rendered matches. Suspend
   playback auto-follow while browsing search matches; let Sync with audio resume
   it. Escape currently clears the store but leaves local input text unchanged.
   Count is currently matching turns, not individual occurrences: label this
   accurately or implement occurrence navigation.

8. **Explicit load/error states.**
   Notepad returns skeletons for missing meetings/transcripts even after failures;
   library can display an empty state for request failures. Render a compact
   error with Retry, and a distinct meeting-not-found state. Add pending guards
   to mutation controls to prevent repeated task creation.

## Priority 2 — visual parity without redesign

- **Keep:** neutral dark canvas, DM Sans/Inter, purple actions, restrained borders,
  icon-strip library navigation, channels/list/AskFred layout, full-screen
  Notepad, left Smart Search heading, center notes, right AskFred/Transcript tabs,
  and bottom transport controls. Do not restore invented hero/stat sections.
- **Measure panel proportions by page.** The original `meetings.png` AskFred rail
  occupies roughly 580 of 1920 screenshot pixels; Notepad right panel is roughly
  475 of 1920. Current global rail is `w-[30rem]` (480px), not the previously
  reported 350px. Avoid blindly assigning one width to both layouts. Preserve
  the user's current adjustments and verify at matched viewport sizes.
- **AskFred detail tab:** remove the second AskFred header inside
  `panels/askfred-panel.tsx`; the parent already supplies the tab heading. Original
  shows a left-aligned greeting, compact rectangular prompts, and a larger
  bottom composer. Current panel uses centered content and pill prompts.
- **Global AskFred rail:** match original left-aligned empty state and compact
  suggestions rather than large full-width bordered cards. Maintain a readable
  composer and chat typography without adding decorative elements.
- **Meeting rows:** retain visible overflow/Details controls. Match their compact
  outlined affordances, row padding, thumbnail sizing, and subtle hover surface.
  Current date group labels are absent from rendered sections; restore only if
  desired after reference comparison, not by overwriting intentional user edits.
- **End-of-list copy:** show it only on the final page. Current implementation
  displays it even when another results page exists.
- **Tasks:** use subtle meeting containers/dividers and restrained right-aligned
  assignee labels. Current source still has standalone hover rows rather than
  enclosing meeting cards. Verify against a fresh original Tasks reference.
- **Modals:** use existing Radix Dialog primitives; standardize elevation, small
  radii, title/body hierarchy, input height, spacing, footer actions, pending/error
  states, and focus behavior. Existing saved original images show rows/panels,
  not enough evidence to claim exact modal parity. Obtain a true modal reference
  before making reference-specific changes.
- **Smaller viewports:** current Notepad has fixed side-panel widths. Collapse
  secondary panels or provide tabs/drawers when content no longer fits; preserve
  original desktop layout. Keep visible focus states and keyboard-operable tabs.
- **Media placeholders:** allowed by PDF; do not add STT or a video-capture system.
  Preserve the player appearance while clearly describing sample/synthetic media.

## Priority 3 — bonus correctness and safety

- **Global keyboard shortcut is not mounted when closed.** SearchDialog installs
  Ctrl/Cmd+K inside itself, but GlobalDialogs renders it only when searchOpen is
  already true. Mount the listener independently or keep the dialog mounted.
  The footer advertises Enter-to-open, but no input result-selection handler
  implements it. Use the installed `cmdk` primitive or a complete keyboard flow.
- **Unsafe search HTML.** Backend snippets interpolate raw uploaded transcript
  text and frontend renders `dangerouslySetInnerHTML`. Escape content before
  inserting trusted marks, or return plain snippets and highlight in React.
  Handle loading/error results explicitly, not as No results.
- **Tags contract is incomplete.** HTTP adapter calls `/tags` and
  `/meetings/{id}/tags`; no backend routes provide them. Tag dropdown therefore
  cannot populate in real API mode. Complete the existing bonus, no new tag
  dashboard required.
- **Citations disappear.** Both chat GET endpoints return `citations: None`,
  discarding saved JSON. All chat UIs refetch those endpoints after sending, so
  citations vanish even when POST returns them.
- **Rule-chat inputs are incomplete.** Router omits `end_ms`, breaking duration
  questions; global chat passes no action items, yielding false No action items
  answers. Global citations can have null meeting titles although response schema
  requires strings. Action-item citation filtering uses the last loop variable
  rather than each action's provenance. Fix these before replacing the engine.
- **Validation:** enforce nonblank descriptions/questions/titles, allowed status
  values, sensible soundbite ranges, and same-meeting segment/assignee references.
  Foreign keys alone do not enforce these semantic relationships.
- **Dark mode bonus:** dark theme exists; light theme CSS/package presence does
  not mean a working toggle exists. Light mode is not required by the PDF.
- **Exports:** TXT/Markdown satisfy the bonus; PDF is optional. Do not add it just
  to satisfy an inaccurate artifact claim unless the user still wants all formats.

## Code quality, schema, and documentation

- Fix four lint errors (`notes-panel`, `transcript-line`, `transcript-panel`,
  `auth-gate`) and unused imports. Build success is not equivalent to lint success.
- Keep the normalized schema: transcript rows, participants, structured summaries,
  independent tasks, and provenance are good design choices. Add real indexes for
  common meeting/date, meeting/segment-time, and task queries; LLD documents
  indexes/constraints not actually declared by ORM models.
- Use typed request/response models consistently. Frontend HTTP generics are
  assertions, not runtime validation: they did not catch participant shape drift.
- Move shared classification helpers out of `frontend/src/mock/engine.ts` so real
  UI does not depend on a mock implementation. Reuse summary-persistence logic
  between create and regenerate rather than duplicating it in routers.
- Use SQL filtering/pagination and eager loading where useful instead of loading
  every meeting and issuing repeated per-row queries. No new repository framework
  or major architecture rewrite is necessary for this assignment.
- Add isolated tests with temporary SQLite databases, lifecycle/restart checks,
  participant edits, task edits/unassignment, repeated regeneration, invalid
  payloads, imports, citation persistence, and delete cascades. Add a small browser
  regression suite for seeking, find navigation, filters, and global shortcut.
- Correct README and docs: they claim implemented LLM activation, FTS5, multipart
  upload, PDF exports, light-mode toggle, migrations, and complete task editing
  where those are missing or only planned. Mark design plans versus shipped
  behavior. LLM configuration currently makes no actual model calls.
- Update schema/count/version inconsistencies (14 versus 16 tables; Next 15 versus
  16), the default mocks behavior, and the incorrect historical explanations of
  the player bug. The confirmed fix was the stale virtual-clock closure.
- Include current screenshots and an honest requirement checklist in README.
  Prepare interview explanations of player synchronization, DB relationships,
  cache invalidation, parsing tradeoffs, and deterministic versus LLM generation.

## Recommended order / approval checkpoints

1. **Core-completeness pass:** participant/date/task controls; speaker inference;
   repeat-safe regeneration; safe startup seeding; typed detail response.
2. **Reliability pass:** transcript find/follow, errors, shortcut, tags, safe search
   snippets, citation persistence and chat input fixes; isolated tests + lint.
3. **Reference-based visual pass:** fresh screenshots at identical sizes; targeted
   panel/AskFred/Tasks/modal adjustments; documentation corrected to match reality.
4. **LLM integration:** backend-only provider adapter, structured validated summary
   output, grounded meeting-scoped answers with validated citations, timeout/error
   fallback, and no frontend API keys. Keep the approved UI unchanged.

Review each pass with the user before moving to the next. Do not extend placeholder
auth, integrations, collaboration, or speech-to-text to complete this assignment.
