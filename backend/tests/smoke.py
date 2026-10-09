"""Backend smoke test — verify seed + core endpoints work (docs/05 Phase 5)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.database import SessionLocal, init_db
from app.main import app
from app.seed.seed import seed_all

# init + seed
init_db()
with SessionLocal() as db:
    seed_all(db)

client = TestClient(app)


def check(name: str, cond: bool, detail: str = ""):
    status = "OK" if cond else "FAIL"
    print(f"{status} {name}" + (f": {detail}" if detail else ""))
    return cond


ok = True

# health
r = client.get("/api/v1/health")
ok &= check("health", r.status_code == 200 and r.json()["meetings"] > 0, f"meetings={r.json().get('meetings')}")

# me
r = client.get("/api/v1/me")
ok &= check("me", r.status_code == 200 and r.json()["name"] == "Vishesh Gupta")

# dashboard
r = client.get("/api/v1/dashboard")
d = r.json()
ok &= check("dashboard", r.status_code == 200 and d["total_meetings"] > 0, f"total={d['total_meetings']}, tasks={d['open_tasks']}")

# meetings list
r = client.get("/api/v1/meetings")
m = r.json()
ok &= check("meetings list", r.status_code == 200 and m["total"] > 0, f"total={m['total']}, first={m['items'][0]['title'] if m['items'] else 'none'}")

# meetings filter
r = client.get("/api/v1/meetings?tag=sales")
ok &= check("meetings tag filter", r.status_code == 200 and r.json()["total"] >= 1, f"sales={r.json()['total']}")

# meeting detail (pick a ready meeting with a transcript)
r = client.get("/api/v1/meetings?status=ready")
ready_items = r.json()["items"]
mid = ready_items[0]["id"] if ready_items else 1
r = client.get(f"/api/v1/meetings/{mid}")
ok &= check("meeting detail", r.status_code == 200 and "participants" in r.json())

# transcript
r = client.get(f"/api/v1/meetings/{mid}/transcript")
t = r.json()
ok &= check("transcript", r.status_code == 200 and len(t["segments"]) > 0, f"segments={len(t['segments'])}, duration={t['duration_ms']}")

# stats
r = client.get(f"/api/v1/meetings/{mid}/stats")
s = r.json()
ok &= check("stats", r.status_code == 200 and len(s["speakers"]) > 0, f"speakers={len(s['speakers'])}, filters={s['filters']}")

# summary
r = client.get(f"/api/v1/meetings/{mid}/summary")
sm = r.json()
ok &= check("summary", r.status_code == 200 and len(sm["sections"]) > 0, f"sections={len(sm['sections'])}")

# action items
r = client.get("/api/v1/tasks")
tasks = r.json()
ok &= check("tasks", r.status_code == 200 and len(tasks) > 0, f"count={len(tasks)}")

# create meeting
r = client.post("/api/v1/meetings", json={
    "title": "Smoke Test Meeting",
    "meeting_date": "2026-10-09T12:00:00Z",
    "participants": [{"name": "Ada Lovelace"}],
    "transcript_text": "00:02 Ada Lovelace: Hello, let's test the API.\n00:15 Ada Lovelace: I'll send the report by Friday.",
})
ok &= check("create meeting", r.status_code == 201 and "id" in r.json(), f"status={r.json().get('status')}")

# settings
r = client.get("/api/v1/settings")
ok &= check("settings", r.status_code == 200 and "theme" in r.json())

# --- Phase 6 endpoints ---

# search
r = client.get("/api/v1/search?q=pricing")
sr = r.json()
ok &= check("search", r.status_code == 200 and sr["total"] > 0, f"total={sr['total']}")

# AskFred chat (meeting-scoped)
r = client.post(f"/api/v1/meetings/{mid}/chat", json={"question": "When was pricing discussed?"})
cr = r.json()
ok &= check("chat meeting", r.status_code == 200 and "answer" in cr and len(cr["citations"]) > 0,
            f"answer={cr['answer'][:60]}..., citations={len(cr['citations'])}")

# AskFred chat (global)
r = client.post("/api/v1/chat", json={"question": "What action items do I have?"})
gr = r.json()
ok &= check("chat global", r.status_code == 200 and "answer" in gr)

# export (txt + json)
r = client.get(f"/api/v1/meetings/{mid}/export?format=txt")
ok &= check("export txt", r.status_code == 200 and "Transcript" in r.json()["content"])
r = client.get(f"/api/v1/meetings/{mid}/export?format=json")
ok &= check("export json", r.status_code == 200 and "transcript" in r.json()["content"])

# comments
r = client.post(f"/api/v1/meetings/{mid}/comments", json={"body": "Phase 6 smoke test comment"})
ok &= check("add comment", r.status_code == 200 and "id" in r.json())
r = client.get(f"/api/v1/meetings/{mid}/comments")
ok &= check("list comments", r.status_code == 200 and len(r.json()) > 0)

# bookmarks
r = client.post(f"/api/v1/meetings/{mid}/bookmarks", json={"segment_id": 1, "label": "test"})
ok &= check("add bookmark", r.status_code == 200 and "id" in r.json())
r = client.get(f"/api/v1/meetings/{mid}/bookmarks")
ok &= check("list bookmarks", r.status_code == 200)

# soundbites
r = client.post(f"/api/v1/meetings/{mid}/soundbites", json={"title": "test clip", "start_ms": 0, "end_ms": 5000})
ok &= check("add soundbite", r.status_code == 200 and "id" in r.json())
r = client.get(f"/api/v1/meetings/{mid}/soundbites")
ok &= check("list soundbites", r.status_code == 200)

# chat history
r = client.get(f"/api/v1/meetings/{mid}/chat")
ok &= check("chat history", r.status_code == 200 and len(r.json()) > 0)

print(f"\n{'All green' if ok else 'FAILURES'}")
sys.exit(0 if ok else 1)
