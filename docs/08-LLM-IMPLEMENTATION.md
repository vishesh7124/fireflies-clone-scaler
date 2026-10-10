# Groq + hybrid RAG implementation phases

Goal: implement the README extension without changing the approved Fireflies UI.
Review each phase with the user before proceeding. Never overwrite user records
or task completion state to test AI features.

| Phase | Deliverable | Review gate |
|---|---|---|
| 1 — Foundation | Groq configuration/client, internal output contracts, safe errors, mocked tests | Tests pass; no live requests or endpoint behavior changes |
| 2 — Meeting AI | Summaries/meeting chat, grounded citations, bounded context, validated persistence and rule fallback | Roundtrip works; tasks preserved; live check only with explicit opt-in |
| 3 — Hybrid retrieval | Revision-aware chunks, FTS5, embeddings/sqlite-vec, worker, fusion and bounded reranking | Scope-isolated retrieval; edits/deletes invalidate indexes; resource budget established |
| 4 — Global AskFred | Validated intent/scope planning, exact SQL, hybrid retrieval, context expansion and bounded history | Task/date and discussion questions return accurate results and source links |
| 5 — Verify/document | End-to-end tests, retrieval-quality fixtures, failures/fallback, provider/privacy diagnostics and VM guidance | User approves behavior and unchanged visuals |

## Phase 1 status

Implemented:

- Backend-only `LLM_ALLOW_EXTERNAL` opt-in, masked API key, configurable Groq
  HTTPS URL/model, output mode, timeout/retry/input/output limits. Model defaults
  to empty: operators must explicitly choose a supported model.
- Async JSON generation using a shared `httpx.AsyncClient`, closed on application
  shutdown. JSON-object mode is default; strict JSON-schema mode is selectable
  for supported Groq models.
- Internal Pydantic answer, summary, action-suggestion, and query-plan contracts.
  Query plans contain no executable SQL. Source IDs still require database/scope
  validation in Phase 2/4; shape validation alone is not grounding.
- Sanitized errors. Only transient network/timeouts, 429 and selected 5xx
  responses retry, with bounded backoff and an overall deadline. Redirects are
  not followed. Prompts, provider response bodies, and secrets are never logged.
- Tests use `httpx.MockTransport`; no real keys, network, or database needed.

Verification: 20 mocked-provider/contract tests and all 10 existing isolated
core regression tests pass. No live Groq request was made.

At the Phase 1 checkpoint the shared client was available as
`app.state.llm_client`, without router wiring. Phase 2 below adds that wiring.

### Verification

```bash
cd backend
pip install -r requirements.txt
python tests/test_llm_client.py
python tests/test_core.py
```

`test_core.py` uses temporary SQLite storage. Do not substitute destructive
`smoke.py` against user data. Keep `LLM_ALLOW_EXTERNAL=false` until explicitly
opting into sending selected content externally. Keys belong only in backend
configuration, never chat messages or frontend `NEXT_PUBLIC_*` settings. See
`backend/.env.example`.

Groq reference docs checked for Phase 1:

- https://console.groq.com/docs/openai
- https://console.groq.com/docs/structured-outputs

Strict structured-output support varies by model. Unsupported provider formats
must fail safely, not silently switch providers or bypass local validation.

## Phase 3 resource constraint

The existing VM was reported as 1 vCPU / 1 GiB. Do not download Torch/embedding
models/rerankers there before sizing memory. Keep adapters separable for a
worker or hosted inference endpoint while SQLite stays the source of truth.
Review that choice before enabling the full embedding/reranking branch.

## Phase 2 status — meeting summaries and grounded chat

Implemented, awaiting user review:

- Meeting imports and explicit summary regeneration use Groq only with backend
  opt-in/key/model; meeting-scoped chat uses the same gated client. Global chat
  stays rule-based until Phase 4. No frontend layout or API response shape changed.
- Provider calls happen outside database transactions. Complete JSON output is
  validated before a short atomic save. Snapshot hashes protect against concurrent
  transcript, participant, task, title, or summary edits; regeneration reports 409
  on conflict rather than overwriting newer data. Chat replaces a stale answer
  with a rule answer from the current snapshot before persisting.
- Citations are deduplicated and resolved only from supplied meeting segment IDs.
  Quotes/timestamps/speakers come from storage, not model output. This validates
  source identity/scope, not semantic truth; live quality still needs evaluation.
- Meeting chat includes the last six scoped messages, bounded to 1500 characters
  each, as untrusted conversational context. Full meeting context is bounded by
  the client's input guard. Oversized context currently falls back to whole-input
  rules rather than truncating the transcript; long-input LLM chunking remains
  future work.
- Regeneration preserves all existing tasks. LLM task suggestions are stored in
  a new additive `task_suggestions` table and never automatically overwrite or
  complete tasks. Exact source/description/revision duplicates are suppressed.
- Suggestion listing, explicit accept and dismiss API routes are available.
  Acceptance is idempotent, scoped to the correct meeting, and checks the source
  text hash. A changed/deleted source cannot be accepted. Dismissed suggestions
  remain dismissed for the same source/text revision. There is no new suggestion
  UI in this phase, preserving the user's approved visual baseline.
- Provider failures, bad output/source IDs, and budget failures fall back to
  rules. With no key/opt-in, existing behavior is unchanged.

### Phase 2 verification

```bash
cd backend
python tests/test_meeting_ai.py
python tests/test_llm_client.py
python tests/test_core.py
```

All tests use fake HTTP transport and/or temporary SQLite. No real Groq calls or
user-record changes were made. Live behavior requires a backend-only key and
explicit opt-in; never paste the key into chat. The new table is created on
startup without reseeding or modifying the existing core tables.

Verified: 16 meeting-AI integration tests + 20 client/contract tests + 10 core
regression tests pass (46 total). Diff whitespace checks pass. No frontend files
were changed in this phase.

### New suggestion routes

- `GET /api/v1/meetings/{id}/action-suggestions`
- `POST /api/v1/meetings/{id}/action-suggestions/{suggestion_id}/accept`
- `POST /api/v1/meetings/{id}/action-suggestions/{suggestion_id}/dismiss`

No endpoint accepts generated SQL or model-supplied timestamps. LLM embeddings,
reranking, and global planning still await Phases 3–4.

## Phase 3 status — hybrid retrieval and indexing

Implemented, awaiting user review:

- Three additive derived tables: revision state, source-linked transcript/summary
  chunks, and versioned float32 embeddings. A native FTS5 virtual table provides
  lexical ranking. Original meetings/transcripts/tasks are never replaced by the
  indexer; schema initialization/backfill is repeat-safe.
- Database triggers invalidate evidence for transcript, summary, participant, and
  meeting edits. Cascading deletion removes chunks, embeddings, and FTS rows.
  Searches exclude stale revisions immediately, even before rebuilding finishes.
- A single bounded polling thread builds indexes outside request handling, without
  holding write locks during inference. It rechecks revisions before publishing,
  retries unavailable inference after a delay, and closes with application lifespan.
- Transcript chunks retain source segment IDs and timestamp ranges, splitting
  oversized turns and using modest turn overlap. Chunk size is character-bounded,
  **not an exact token count**. Local models reject over-token-limit inputs rather
  than silently truncating them. Whole-transcript LLM summary chunking is still
  separate future work; Phase 2 retains rule fallback for oversized requests.
- Scope filtering supports meeting IDs, inclusive calendar dates, and exact
  resolved participant names. Discovery can focus on speaker-linked chunks;
  expanded neighboring turns retain other speakers' replies. An explicit empty
  meeting scope never becomes workspace scope.
- Lexical and semantic candidates are fused using reciprocal rank fusion, then
  optionally cross-encoder-reranked within a small candidate cap. Source windows
  are expanded, deduplicated, kept chronological, and revalidated after inference.
  Unsourced summary hits can identify meetings, but cannot fabricate source turns.
- Semantic search uses real `sqlite-vec` cosine operations over scoped BLOB rows.
  This is **flat exact search, not ANN/HNSW**; it avoids a separate vector server
  and fits the demo corpus. Larger deployments should benchmark a different index.
- Inference adapters support disabled mode, opt-in local Sentence Transformers,
  or an authenticated remote worker. Remote response sizes/model identities/vector
  dimensions/finite values are validated. Missing models/extensions, bad vectors,
  or unavailable rerankers retain keyword/rank-fusion fallback.
- The optional worker is `app/rag_worker.py`. It has bounded inputs, a backend-only
  shared secret, configured-model-only execution, and no database access. Do not
  expose it without HTTPS/authentication. It is not Groq's embeddings API.
- Health exposes indexing/pending/vector counts and inference mode. Global
  AskFred still uses rules until Phase 4; existing UI and endpoints are unchanged.

### Phase 3 verification

```bash
cd backend
pip install -r requirements.txt
python tests/test_retrieval.py
python tests/test_meeting_ai.py
python tests/test_llm_client.py
python tests/test_core.py
```

Retrieval tests use real temporary SQLite/FTS5/sqlite-vec with fake embedding and
reranking adapters. They cover scoped semantic matches without shared keywords,
fallbacks, version changes, edit/delete invalidation, stale publication, context
windows, bounded chunking, remote contracts, worker authentication, and restart-safe
schema initialization. No pretrained models were downloaded or loaded, no live
provider was called, and no VM/user data was modified.

Verified: 29 retrieval tests + the previous 46 provider/meeting/core tests pass
(75 total). Native vector/FTS execution is tested; real pretrained-model quality
and hardware memory usage are not yet tested. Whitespace checks pass.

### Safe deployment modes

1. **Current small API VM:** normal `requirements.txt`, `RAG_INDEXING_ENABLED=true`,
   `RAG_INFERENCE_MODE=disabled`. Lexical indexes work; Torch is not imported.
2. **Full hybrid on a larger worker:** install `requirements-rag-local.txt` there,
   cache the embedding/reranking models (downloads require explicit
   `RAG_ALLOW_MODEL_DOWNLOAD=true`), and configure `RAG_WORKER_KEY`.
   Run one `uvicorn app.rag_worker:app --host 127.0.0.1 --port 8001` process behind
   HTTPS. On the API VM choose `RAG_INFERENCE_MODE=remote`,
   `RAG_ALLOW_EXTERNAL=true`, the worker URL, and the matching secret/model/revisions.
3. **Local inference:** optional `RAG_INFERENCE_MODE=local`, but only after RAM/CPU
   sizing. Do not assume the existing 1 GiB VM can hold Torch and both models.

Pin `RAG_EMBEDDING_REVISION` and `RAG_RERANKER_REVISION` for reproducibility.
Changing chunk profile/model identity queues rebuilding. Unpinned `default`
revisions cannot detect upstream weight changes automatically. `RAG_MAX_INDEX_SECONDS`
is a between-batch budget, not a hard interrupt of a running CPU inference call.
Provider credentials and model inference stay on the backend/worker, never in
`NEXT_PUBLIC_*` variables. The API needs only the lightweight native vector package
when using remote inference, not the optional local-model dependencies.

**Remaining:** actual model/VM resource and answer-quality validation, and Phase 4
scope planning, exact task/count SQL, meeting-context assembly, and global Groq chat.

## Phase 4 status — global AskFred

Implemented, awaiting user review:

- Global `/api/v1/chat` now calls a backend orchestration service with a bounded
  read-only meeting/participant catalog, six scoped global history messages,
  current date/timezone, and a validated internal query-plan schema. No model SQL
  is accepted or executed. Unknown/ambiguous actors and meeting references are
  clarified rather than silently becoming workspace scope.
- Model filters cannot arbitrarily narrow to an unmentioned meeting, participant,
  date preset, or status. Explicit IDs, relative dates, supported count targets,
  personal-task assignment, and latest-meeting selectors resolve on the backend.
  These guards do not constitute proof of perfect natural-language understanding;
  live model interpretation still needs quality evaluation.
- Parameterized SQL returns exact task/meeting counts and task records, with due,
  creation, completion, status and participant criteria. Counts do not depend on
  catalog/list limits. Backend formatting prevents model arithmetic from changing
  the result. Overdue and not-done predicates distinguish in-progress from completed
  tasks. Pending suggestions remain separate from accepted action items.
- Relative dates use `WORKSPACE_TIMEZONE`, Monday-start weeks, inclusive calendar
  endpoints and half-open SQL boundaries. UTC conversion is used for meeting/
  created/completed timestamps; due dates retain calendar semantics. A UTC
  serializer and offset-normalized meeting writes fix timezone ambiguity without
  rewriting existing stored records. Existing naive dates are assumed UTC.
- Discussion questions use the Phase 3 hybrid pipeline with per-meeting diversity,
  surrounding replies, scoped metadata/summary/task context, and a character budget.
  Missing/pending indexes use current scoped keyword windows. Short selected
  transcripts may be included fully. Partial coverage is disclosed rather than
  implying all workspace decisions were reviewed.
- Answers cite only supplied transcript segment IDs; meeting titles, speakers,
  timestamps and quotes are resolved from stored snapshots. Cross-scope/unprovided
  source IDs fall back to the same scoped evidence. History is context, not evidence.
- Read snapshots/stamps guard changes to meetings, transcripts, summaries, tasks,
  and latest-meeting selection. Stale generated answers become retry messages
  before persistence. No DB transaction is held during inference.
- An overall global deadline covers planner/retrieval/answer stages. Fallback
  avoids another provider attempt. Cancel events prevent abandoned read workers
  from starting a subsequent inference stage; already-running synchronous model
  calls cannot be forcibly interrupted and retain their own limits.
- Existing frontend/API response shapes are unchanged. Global citations persist
  and continue to navigate to source meeting timestamps.

### Phase 4 verification

```bash
cd backend
python tests/test_global_ai.py
python tests/test_retrieval.py
python tests/test_meeting_ai.py
python tests/test_llm_client.py
python tests/test_core.py
```

Verified: 37 global/calendar integration tests + the prior 75 tests pass
(112 total), with fake providers and temporary databases. Cases include exact
SQL counts beyond display/catalog caps, timezone/relative-date boundaries,
overdue in-progress tasks, multi-period evidence, source isolation, missing-index
fallback, scoped history, clarifications, deadlines and concurrent edits.
No live provider/model was used and no user records were changed by tests.

### Explicit limits / Phase 5 gate

- SQL aggregate targets are meetings and accepted tasks, not arbitrary workspace
  entities or exhaustive semantic topic counts. Tag/channel/team filtering is not
  yet a global planner capability; existing library tag filters still work.
- The conservative no-provider parser is intentionally limited. Unsupported
  calendar language requests ISO dates; it must not widen scope to compensate.
- The schema stores per-meeting participant names, not a production identity/tenant
  system. Duplicate first names need clarification; true multi-tenant authorization
  is outside the mocked-auth assignment and would be required for production.
- Live Groq interpretation/answer quality and real embedding/reranker memory/latency
  are still unverified. The existing small VM should remain lexical-only or use an
  appropriately sized remote worker until measured.
- Phase 5 remains: public-provider abuse/budget safeguards, labeled quality checks,
  complete UI/API roundtrips, accurate setup/deployment documentation, and live
  checks only after backend credentials and external-data consent are configured.

## Phase 5 status — safeguards and live verification

Implemented:

- The key entered in tracked `.env.example` was relocated to ignored local
  `backend/.env` without printing it; example/history/index checks found no
  committed copy of that key. Verified local settings use `openai/gpt-oss-20b`,
  strict JSON schema and a 4096-token output cap. No VM deployment was performed.
- Provider request/day/minute caps and conservative token reservations persist in
  SQLite; retries cannot bypass them. Concurrent provider calls are bounded per
  process. AI endpoints have a bounded per-IP throttle using ASGI peer identity,
  not raw forwarded headers. CORS error responses and Retry-After were tested.
- Live checks use explicit `--live`, synthetic/fixture content and disposable
  databases. They distinguish actual validated model output from rule fallback,
  use bounded call budgets and produce secret-free reports.
- Small summary/chat/task/comparison/absence cases passed live after fixes. The
  full seeded kickoff summary also passed with actual `generated_by=llm`, source
  validation and correct October 30 fact. [Quality report](10-GROQ-QUALITY-REPORT.md)
  retains initial failures and states what is and is not verified.
- Live failures led to a fixed-field internal summary contract: overview, notes,
  topics, metrics and action suggestions. Backend-created public sections keep
  the same frontend contract. Strict schemas are sent once rather than duplicated
  in the prompt, and repetitive per-segment meeting metadata is omitted.
- Pending/current retrieval indexes now contribute context together, preventing a
  just-regenerated meeting from being omitted in comparisons. Grounding instructions
  explicitly prohibit metric substitution (e.g. price versus CAC).
- Browser checks used the unchanged frontend against a disposable real-Groq API:
  meeting/global chat HTTP 200, source citation interaction, zero page errors and
  no key in browser DOM. [Screenshots/checks](screenshots/llm-live/).
- [Operations](09-GROQ-OPERATIONS.md) describes safe backup/update, private env
  merging, quotas, proxy trust, resource limits and isolated/live verification.
  Root README hosting/API/schema/AI claims were corrected to implemented behavior.

Final offline checks: 123 tests pass (20 client, 16 meeting AI, 29 retrieval,
38 global AI/calendar, 10 core, 10 safety). Frontend production build, lint and
diff whitespace checks pass. A publishable-file scan found no copy of the live
key; `backend/.env` is ignored. Live checks are separate from the 123 fake-provider
regression tests and remain sample-specific evidence, not a general accuracy claim.

**Remaining limitations, not silently marked complete:** actual pretrained-model
memory/semantic-quality evaluation on a sized worker; hierarchical LLM summary
chunking for oversized inputs; production authentication/multi-tenant authorization
and centralized multi-instance throttling. The existing VM must remain lexical-only
until resource/inference hosting is explicitly configured and measured.
