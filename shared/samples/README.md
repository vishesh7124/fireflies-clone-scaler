# shared/samples

Realistic sample transcripts for testing the **real-data upload flow** through
the app's Uploads page (`/uploads`).

## Files

| File | Format | Use it to test |
|---|---|---|
| `sample-meeting.txt` | `mm:ss Speaker: text` lines (the native format) | Paste dialog or `.txt` upload |
| `sample-meeting.vtt` | WebVTT cues with speaker prefixes | `.vtt` file upload (tests the VTT parser) |

Both are the **same 22-turn discovery call** (Sarah Watts × Tom Reyes × Emily
Chen) — deliberately written to exercise every AI feature:

- **Questions** (for the smart-search Questions filter): *"What tools are you using?"*
- **Tasks / action items**: *"I'll send the proposal by tomorrow"*, *"I'll schedule a demo"*
- **Dates**: *"next week"*, *"Tuesday or Thursday"*
- **Metrics**: *"3 hours per day"*, *"40%"*, *"2 hours"*, *"$30k"*, *"$19 per user"*
- **Pricing**: budget cap, per-seat pricing, pricing proposal
- **Fillers**: *"So"*, *"basically"*, *"I know"*
- **Sentiment**: positive (*"reassuring"*, *"impressive"*) + negative (*"problem"*, *"burned"*, *"failed"*)

## How to use

1. Start backend + frontend (see root README)
2. Go to `http://localhost:3000/uploads`
3. Click **Browse Files** and pick `sample-meeting.vtt` (or `.txt`), **or** click
   **"Paste a transcript instead"** and paste the `.txt` content
4. Click **Upload** (or **Create meeting**) → the meeting is created with:
   - full transcript (click any line to seek)
   - auto-generated summary (overview / notes / topics / metrics)
   - action items with assignees + provenance
   - smart-search filters with counts
   - AskFred answers with timestamped citations

## Transcript formats accepted

| Format | Pattern |
|---|---|
| `.txt` (native) | `00:04 Sarah Watts: Hi Tom…` — `mm:ss` (or `h:mm:ss`) + speaker + text |
| `.vtt` / `.srt` | Standard WebVTT/SubRip cues; speaker parsed from `Name: text` lines |
| `.json` | `[{ "speaker": "…", "start": 0, "end": 14, "text": "…" }]` (or `segments`/`utterances` wrappers; seconds or ms) |

## Where to find more real transcripts

- **Fireflies export**: Fireflies → any meeting → ⋯ menu → Download → Transcript (`.txt`/`.json`)
- **Zoom**: Recording details → Download → Audio transcript (`.vtt`)
- **Google Meet**: Activity dashboard → recording → Download transcript
- **Otter.ai / Rev / Descript**: export as `.txt`/`.json`/`.vtt`
- Or copy the transcript lines from `shared/fixtures/meeting-*.json` (the seed data)
