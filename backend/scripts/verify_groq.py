"""Opt-in live Groq verification against disposable, explicitly synthetic data.

Run: python scripts/verify_groq.py --live
Writes only a temporary database and a secret-free report under docs/.
Never seeds, regenerates, or chats against the configured user database.
"""
import argparse
import json
import logging
import os
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--live", action="store_true", help="Consent to send synthetic samples to Groq")
parser.add_argument("--only", choices=["summary", "meeting_chat", "global_comparison", "global_tasks", "abstention"])
parser.add_argument("--format", choices=["json_object", "json_schema"])
parser.add_argument("--serve", type=int, help="Serve disposable live demo on loopback port instead of running cases")
parser.add_argument("--fixture", choices=["meeting-01.json"], help="Verify the full seeded kickoff transcript; use --only summary")
parser.add_argument("--model", help="Override model only for this verification run")
parser.add_argument("--output-tokens", type=int, help="Override bounded completion size for this run")
args = parser.parse_args()
if not args.live:
    parser.error("Live checks require --live; no request was made.")

tmp = tempfile.TemporaryDirectory(prefix="fireflies-groq-quality-")
os.environ.update({"FI_REFLIES_DB_PATH": str(Path(tmp.name) / "test.db"),
    "MEDIA_DIR": str(Path(tmp.name) / "media"), "SEED_ON_START": "false",
    "LLM_ALLOW_EXTERNAL": "true", "RAG_INFERENCE_MODE": "disabled", "RAG_INDEXING_ENABLED": "false",
    "LLM_REQUESTS_PER_DAY": "12", "LLM_MAX_RETRIES": "0"})
if args.format:
    os.environ["LLM_RESPONSE_FORMAT"] = args.format
if args.model:
    os.environ["LLM_MODEL"] = args.model
if args.output_tokens:
    os.environ["LLM_MAX_OUTPUT_TOKENS"] = str(args.output_tokens)
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.config import settings
from app.database import SessionLocal, engine, init_db
from app.models import User, Meeting, Participant, TranscriptSegment, ActionItem, ProviderUsage
from app.services.retrieval_indexer import Indexer
from app.services.retrieval_inference import Inference
from app.services.llm_client import LLMClient, LLMError
from pydantic import ValidationError

if not settings.llm_enabled:
    raise SystemExit("A backend-only key and model are required. No key is printed.")

events = []
class FallbackLog(logging.Handler):
    def emit(self, record):
        if "fallback" in record.getMessage().lower():
            events.append(record.getMessage())

handler = FallbackLog()
for name in ["app.services.meeting_ai", "app.services.global_ai"]:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)

init_db()
today = datetime.now(timezone.utc).date()
month = today.replace(day=1)
previous = (month - timedelta(days=1)).replace(day=15)
with SessionLocal() as db:
    user = User(name="Ada", email="synthetic@example.test", avatar_color="#7c5cff", is_default=True)
    db.add(user)
    db.flush()
    mids, source_ids = [], []
    statements = [
        [("Ada", "We considered a subscription price of $150 per user."),
         ("Bob", "We rejected the $150 proposal and approved a price of $120 per user."),
         ("Ada", f"I will send the approved quote on {today.isoformat()}."),
         ("Bob", "The launch deadline is October 30. No IPO valuation was discussed.")],
        [("Ada", "We approved a subscription price of $100 per user for the September contract.")],
    ]
    for n, rows in enumerate(statements):
        meeting = Meeting(title="Synthetic Current Pricing" if n == 0 else "Synthetic Prior Pricing",
            meeting_date=datetime.combine(today if n == 0 else previous, datetime.min.time()), host_id=user.id, status="ready",
            duration_seconds=60, media_type="audio")
        db.add(meeting)
        db.flush()
        mids.append(meeting.id)
        people, ids = {}, []
        for i, (name, statement) in enumerate(rows):
            if name not in people:
                person = Participant(meeting_id=meeting.id, name=name, avatar_color="#7c5cff")
                db.add(person)
                db.flush()
                people[name] = person.id
            segment = TranscriptSegment(meeting_id=meeting.id, speaker_id=people[name], text=statement,
                start_ms=i * 10000, end_ms=i * 10000 + 9000, order_index=i)
            db.add(segment)
            db.flush()
            ids.append(segment.id)
        source_ids.append(ids)
        if n == 0:
            db.add(ActionItem(meeting_id=meeting.id, description="Send approved quote", assignee_id=people["Ada"],
                due_date=datetime.combine(today, datetime.min.time()), source_segment_id=ids[2], status="open"))
    db.commit()

if args.fixture:
    if args.only != "summary":
        raise SystemExit('--fixture requires --only summary')
    from app.seed.seed import _seed_meeting
    from app.models import Channel
    with SessionLocal() as db:
        channel = Channel(name="My Meetings", is_default=True)
        db.add(channel)
        db.flush()
        user = db.scalar(select(User))
        fixture = json.loads((ROOT / "shared/fixtures" / args.fixture).read_text(encoding="utf-8"))
        _seed_meeting(db, fixture, user, channel)
        db.commit()
        mids[0] = db.scalar(select(Meeting.id).order_by(Meeting.id.desc()))

inference = Inference(settings)
indexer = Indexer(settings, inference)
for mid in mids:
    indexer.index_meeting(mid)
inference.close()

if args.serve:
    import uvicorn
    print("Serving synthetic temporary workspace on loopback. No key printed.", flush=True)
    try:
        uvicorn.run(app, host="127.0.0.1", port=args.serve, log_level="warning", access_log=False)
    finally:
        engine.dispose()
        tmp.cleanup()
    raise SystemExit(0)

report = {"date": datetime.now(timezone.utc).isoformat(), "model": settings.llm_model,
          "response_format": settings.llm_response_format, "data": "synthetic temporary database only",
          "inference_mode": settings.rag_inference_mode, "cases": []}
with TestClient(app) as client:
    validation_errors = []
    plans = []
    summary_drafts = []
    class QualityClient(LLMClient):
        async def generate(self, output, **kwargs):
            result = await super().generate(output, **kwargs)
            if output.__name__ == "QueryPlan":
                plans.append(result.model_dump())
            elif output.__name__ == "SummaryDraft":
                summary_drafts.append(result.model_dump())
            return result
        def _validate(self, body, output):
            try:
                return super()._validate(body, output)
            except LLMError as error:
                if error.reason == "invalid_output":
                    try:
                        content = json.loads(body)["choices"][0]["message"]["content"]
                        output.model_validate_json(content)
                    except ValidationError as invalid:
                        validation_errors.append([{"type": e["type"], "path": list(e["loc"])}
                            for e in invalid.errors(include_input=False, include_context=False)])
                    except Exception:
                        validation_errors.append([{"type": "invalid_json"}])
                raise
    original = app.state.llm_client
    rejections = []
    async def inspect_rejection(response):
        if response.status_code not in {200, 429}:
            try:
                error = json.loads(await response.aread()).get("error", {})
                detail = {"status": response.status_code, "type": error.get("type"), "code": error.get("code")}
                # Only this disposable-data verifier records redacted provider diagnostics.
                # Production code never logs/returns upstream bodies.
                import re
                message = str(error.get("message", "")).replace(settings.llm_api_key.get_secret_value(), "[REDACTED]")
                detail["message"] = re.sub(r"org_[A-Za-z0-9_-]+", "[ORG]", message)[:500]
                rejections.append(detail)
            except Exception:
                rejections.append({"status": response.status_code})
    original.http.event_hooks["response"].append(inspect_rejection)
    ai = QualityClient(original.config, original.http, original.budget)
    app.state.llm_client = ai
    cases = [
        ("summary", f"/api/v1/meetings/{mids[0]}/regenerate", {"template": "general"}),
        ("meeting_chat", f"/api/v1/meetings/{mids[0]}/chat", {"question": "What final subscription price did we approve?"}),
        ("global_comparison", "/api/v1/chat", {"question": "How did our subscription pricing change since last month?"}),
        ("global_tasks", "/api/v1/chat", {"question": "What are my tasks due this week?"}),
        ("abstention", f"/api/v1/meetings/{mids[0]}/chat", {"question": "What customer acquisition cost was approved?"}),
    ]
    for name, path, body in cases:
        if args.only and args.only != name:
            continue
        before = dict(ai.stats)
        event_start = len(events)
        start = time.monotonic()
        response = client.post(path, json=body)
        result = response.json()
        fallback = events[event_start:]
        facts = False
        if response.status_code == 200:
            if name == "summary":
                text = " ".join(i["text"] for block in result["sections"] for i in block["items"])
                facts = (("October" in text and "30" in text) if args.fixture else ("120" in text and "30" in text)) and result["generated_by"] == "llm"
            elif name == "meeting_chat":
                facts = "120" in result["answer"] and source_ids[0][1] in [c["segment_id"] for c in result["citations"]]
            elif name == "global_comparison":
                facts = "100" in result["answer"] and "120" in result["answer"] and {c["meeting_id"] for c in result["citations"]} == set(mids)
            elif name == "global_tasks":
                facts = "1 matching tasks" in result["answer"] and "Send approved quote" in result["answer"]
            else:
                facts = "enough evidence" in result["answer"] and result["citations"] == []
        record = {"name": name, "status": response.status_code, "elapsed_seconds": round(time.monotonic() - start, 2),
            "provider_requests": ai.stats["requests"] - before["requests"],
            "validated_outputs": ai.stats["validated_outputs"] - before["validated_outputs"],
            "fallbacks": fallback, "expected_facts_pass": facts, "result": result}
        if validation_errors:
            record["validation_errors"] = list(validation_errors)
            validation_errors.clear()
        if plans:
            record["plans"] = list(plans)
            plans.clear()
        if summary_drafts:
            record["model_summary_drafts"] = list(summary_drafts)
            summary_drafts.clear()
        if rejections:
            record["provider_rejections"] = list(rejections)
            rejections.clear()
        report["cases"].append(record)
        print(json.dumps({k: v for k, v in record.items() if k not in {"result", "model_summary_drafts"}}))
    with SessionLocal() as db:
        usage = db.scalar(select(ProviderUsage))
        report["provider_budget"] = {"requests": usage.requests, "token_reservations_or_usage": usage.tokens} if usage else {}
        report["existing_task_preserved"] = db.scalar(select(ActionItem.description)) == "Send approved quote"

directory = ROOT / "docs/live-groq"
directory.mkdir(parents=True, exist_ok=True)
filename = directory / (f"{'seeded-' if args.fixture else ''}{args.only or 'all'}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json")
filename.write_text(json.dumps(report, indent=2), encoding="utf-8")
print("Secret-free report: " + str(filename.relative_to(ROOT)))
engine.dispose()
tmp.cleanup()
