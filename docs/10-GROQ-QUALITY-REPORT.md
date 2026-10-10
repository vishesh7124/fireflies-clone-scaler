# Groq live verification — Phase 5

Provider: Groq; model: `openai/gpt-oss-20b`; strict JSON schema. Reports record UTC
timestamps (October 9 UTC during the October 10 local/session verification).
Only disposable synthetic data and the authored kickoff fixture were transmitted;
no existing user meeting/chat/task records were changed by verification.

## Passing checks

| Case | Verified behavior | Evidence |
|---|---|---|
| Authentication/model availability | HTTP 200; configured model available | Initial live API probe; key never printed |
| Synthetic summary | LLM output retained rejected $150 proposal vs approved $120 and launch deadline | [Report](live-groq/all-20261009-185649.json) |
| Meeting question | Correct final price, correct Bob source segment/timestamp | [API report](live-groq/all-20261009-185649.json), [browser](screenshots/llm-live/meeting-chat.png) |
| Global personal tasks | Live query planner plus exact SQL: one matching Ada task in the correct week | [Report](live-groq/global_tasks-20261009-190313.json), [browser](screenshots/llm-live/global-tasks.png) |
| Global cross-period pricing | Live planner + answer, $100 to $120 with citations from both meetings, no fallback | [Report](live-groq/global_comparison-20261009-190951.json) |
| Missing metric | Did not substitute subscription price for customer acquisition cost; abstained | [Report](live-groq/abstention-20261009-190701.json) |
| Full seeded transcript | Actual `generated_by=llm`, correct October 30 fact, valid source IDs, no fallback | [Report](live-groq/seeded-summary-20261009-193224.json) |
| Browser roundtrip | Meeting/global chat HTTP 200, citation interaction, no page errors/key in DOM | [Checks](screenshots/llm-live/browser-checks.json), [citation screenshot](screenshots/llm-live/citation-jump.png) |

Observed sample latency: roughly 0.7–3 seconds for passing cases. These are local
measurements of small/fixture cases, not a production SLA or general accuracy score.

## Failures found and corrected

Earlier reports are retained as evidence, not hidden:

- JSON-object mode emitted too many sections. Strict mode improved small cases,
  but Groq rejected flexible section arrays on the full fixture. The internal
  summary contract now has fixed overview/notes/topics/metrics/action-suggestion
  arrays; the backend creates the same public UI sections. Full fixture passed
  with this contract and a 4096-token completion cap.
- A comparison could omit a just-regenerated meeting when another meeting's index
  was current. Context assembly now merges current keyword windows for pending
  meetings with indexed evidence. A new regression test covers the mixed state.
- Planner output unnecessarily selected meetings/people or treated discussion
  changes as unsupported. Planning instructions now distinguish metadata planning
  from transcript retrieval and specify default workspace scope/empty filters.
- One answer incorrectly equated approved subscription price with CAC. Grounding
  instructions now explicitly prohibit related-metric substitution. The subsequent
  missing-metric case passed. This is a tested improvement, not a proof that future
  model answers can never hallucinate.
- Free-tier rate limiting produced a valid SQL fallback, not a live planner pass.
  The task planner was subsequently verified separately with no fallback.

## Still not claimed

- Citation-ID/schema validation proves identity/scope/shape, **not semantic truth**.
  Factual assertions here are limited to the known tested samples.
- Real pretrained embedding and cross-encoder models were **not** downloaded or
  evaluated. Vector operations are tested with fake embeddings; live Groq used
  lexical retrieval. Full semantic mode needs a sized local/remote worker and a
  separate retrieval-quality/latency evaluation.
- Oversized LLM summary inputs still fall back to rules. Index chunks are not a
  completed hierarchical whole-transcript LLM summary pipeline.
- No actual Azure service deployment/restart or Vercel redeployment was performed
  by these checks. Mock authentication and placeholder model-selection UI remain.

For configuration, privacy/cost controls and VM commands see
[Groq operations](09-GROQ-OPERATIONS.md).

Final offline regression count: **123 passing tests**. Frontend build/lint pass.
These regressions do not make additional live provider calls. The verified local
ignored env uses strict schema and 4096 output tokens; the VM must receive those
settings privately because ignored env files do not travel through Git.
