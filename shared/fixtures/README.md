# shared/fixtures

Sample data authored **once**, consumed **twice**:

1. **Frontend mock layer** (`frontend/src/mock/`) parses these files so the
   entire UI is fully interactive before the backend exists.
2. **Backend seeder** (`backend/app/seed/`) loads the *same files* into SQLite
   in Phase 5 — same parser rules, same normalized ids.

## Format (v1)

One file per meeting (`meeting-01.json` … `meeting-10.json`):

```jsonc
{
  "title": "…",
  "meeting_date": "2026-10-06T15:00:00Z",   // ISO-8601 UTC
  "description": "…",
  "channel": "My Meetings",
  "source": "seed",                          // seed | paste | upload | schedule
  "language": "en",
  "tags": ["sales", "pricing"],
  "participants": [
    { "name": "Sarah Watts", "email": "sarah@…", "host": true }
  ],
  "transcript": [                            // "mm:ss Speaker: text" lines
    "00:04 Sarah Watts: Alright, let's get started…"
  ],
  "summary": {
    "template": "general",                    // general | sales | one_on_one | bant
    "overview": "…",
    "notes": ["…"],
    "topics": [{ "text": "Use case & requirements", "at": "00:00", "end": "10:12" }],
    "metrics": [{ "text": "…", "at": "18:05" }],
    "action_items": [
      { "text": "…", "speaker": "Sarah Watts", "at": "26:40", "status": "open", "due": "2026-10-03" }
    ]
  },
  "comments": [{ "by": "Sarah Watts", "at": "09:14", "body": "…" }],
  "bookmarks": [{ "at": "18:05", "label": "Pricing walk-through" }],
  "soundbites": [{ "title": "…", "at": "14:30", "end": "15:05" }],
  "chat": [{ "role": "user", "content": "…", "cites": ["14:32"] }]
}
```

## Loader-computed fields (both TS and Python implement identically)

- `mm:ss` (or `h:mm:ss`) timecodes → `start_ms`; `end_ms` = `start + max(1500, 600 + words×380)` ms, clamped before the next line
- Speaker colors → the 10-color speaker palette, in participant order
- Per-participant `talk_time_ms` / `word_count`; meeting `duration_seconds` = last `end_ms`
- `"at"` anchors (summary items, action items, comments, chat cites) resolve to
  `source_segment_id` / `segment_id` / citations at load time
- Action-item `speaker` → assignee (the participant who committed)
- `status: "scheduled"` meetings have participants but no transcript/summary
- Chat entries with `"cites"` get citations resolved at load; assistant replies
  without cites are passed as-is

**Do not** add computed fields (ids, `*_ms`, counts) — the loaders own those.
Bump the version in `frontend/src/mock/store.ts` (and backend seeder) when
fixture content changes so cached copies reseed.
