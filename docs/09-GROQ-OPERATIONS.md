# Groq operations and safe deployment

## Verified configuration

Live checks passed with Groq `openai/gpt-oss-20b`, **strict JSON schema**, and a
4096-token completion limit for the full seeded transcript. JSON-object mode
and earlier flexible summary contracts failed some live cases; use the verified
settings rather than treating a key alone as a working configuration.

Merge these into the **VM's existing `backend/.env`**, keeping its database,
media, CORS, and other project settings. Never paste a key into chat or commit it.

```dotenv
LLM_API_KEY=<set privately on the backend>
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=openai/gpt-oss-20b
LLM_RESPONSE_FORMAT=json_schema
LLM_MAX_OUTPUT_TOKENS=4096
LLM_ALLOW_EXTERNAL=true
WORKSPACE_TIMEZONE=UTC
RAG_INDEXING_ENABLED=true
RAG_INFERENCE_MODE=disabled
LLM_MAX_CONCURRENT=2
LLM_REQUESTS_PER_MINUTE=20
LLM_REQUESTS_PER_DAY=200
LLM_TOKENS_PER_DAY=1000000
AI_REQUESTS_PER_IP_MINUTE=30
```

`LLM_ALLOW_EXTERNAL=true` explicitly permits sending bounded transcript/history
context to Groq. Use your workspace's IANA timezone, for example `Asia/Kolkata`,
if UTC does not match users' calendar expectations. Do not put provider credentials
in `NEXT_PUBLIC_*` variables.

## Update the existing Azure service

From the repository root on the VM, after pulling:

```bash
cd backend
source .venv/bin/activate

# Online SQLite backup includes a consistent WAL snapshot. Refuses missing DBs.
python - <<'PY'
from app.config import settings
from pathlib import Path
from datetime import datetime, timezone
import sqlite3
path = Path(settings.fi_reflies_db_path)
if not path.is_file():
    raise SystemExit("Configured database not found; check path before updating.")
backup = path.with_name(path.stem + "-backup-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S") + ".db")
with sqlite3.connect(path) as source, sqlite3.connect(backup) as destination:
    source.backup(destination)
print("Database backed up.")
PY

pip install -r requirements.txt
nano .env
chmod 600 .env
sudo systemctl restart fireflies-api
sudo systemctl status fireflies-api --no-pager
curl -f http://127.0.0.1:8000/api/v1/health
```

Use your actual service name/port if different. New tables/indexes are additive;
do **not** run reseed or `tests/smoke.py`. `create_all()` is not a general migration
system: if deploying an independently modified earlier schema, compare it first.
Never delete an existing table to force compatibility.

No nginx reload is required when its route is unchanged. Keep uvicorn on loopback
behind HTTPS nginx, and trust forwarded headers only from the configured proxy
(normally `127.0.0.1`), not arbitrary internet clients.

## Resource/cost safeguards and limits

- The API never loads Torch in disabled/remote inference mode. The existing
  1 vCPU / 1 GiB VM should stay lexical-only until a measured, adequately sized
  worker is available. Normal requirements install the lightweight native vector
  extension; `requirements-rag-local.txt` is optional and not for this small VM.
- SQLite provider counters persist UTC-day and minute request usage across
  restarts. Every retry reserves another request. Token reservations use a
  conservative UTF-8 request-size bound plus output allowance, refunding only
  confirmed unused provider tokens. Unknown/failed usage retains its reservation.
- Busy/budget-limited/provider-failed requests fall back to rules; IP throttling
  returns HTTP 429 with Retry-After. Groq's own free-tier/token limits can still
  be lower than application limits and were observed during verification.
- Concurrent provider calls and IP buckets are per process. Day/minute provider
  counters share the SQLite file. Run one API process on the small VM. For a
  multi-instance production deployment add centralized throttling/admission.
- These are **not currency billing guarantees**. Set spend/project limits in
  Groq's dashboard too. Mock authentication/single workspace is assignment scope,
  not production authorization for real private customer meetings.

## Verify without changing user records

```bash
python tests/test_core.py
python tests/test_llm_client.py
python tests/test_meeting_ai.py
python tests/test_retrieval.py
python tests/test_global_ai.py
python tests/test_ai_safety.py
```

These use fake providers and/or temporary databases. Live checks require explicit
consent and consume real provider quota, but use only disposable synthetic data
or authored fixture content:

```bash
python scripts/verify_groq.py --live --only meeting_chat --format json_schema
python scripts/verify_groq.py --live --only global_tasks --format json_schema
python scripts/verify_groq.py --live --only global_comparison --format json_schema
python scripts/verify_groq.py --live --only summary --fixture meeting-01.json --format json_schema --output-tokens 4096
```

Run cases separately if free-tier token limits reject a batch. Reports distinguish
validated outputs, fallbacks, and expected-fact checks; HTTP 200 alone is not proof
that Groq generated the answer. Report files contain only synthetic/fixture outputs
and no keys. The local live-demo `--serve` option is loopback-only and is not a
production service configuration.

## Troubleshooting

```bash
sudo journalctl -u fireflies-api -n 80 --no-pager
```

- `llm_enabled=false`: verify opt-in, key and model privately; never print `.env`.
- `provider_rejected`: verify model supports strict schema. Recheck with a sample,
  not real customer transcripts. Production logs do not expose provider bodies.
- `rate_limit` / `budget_limit` / `busy`: inspect configured caps and Groq dashboard;
  avoid retry loops or disabling safety limits just to force an answer.
- `index_pending`: lexical/current-window fallback works while the worker rebuilds.
- No model inference mode/worker: semantic embeddings/reranking cannot be called;
  this does not mean the Groq chat provider is broken.

The live key originally entered in `.env.example` was moved to ignored local
`backend/.env` and the example sanitized. Git HEAD, index, and available example
history did not contain that key. If you published it elsewhere, rotate it.
