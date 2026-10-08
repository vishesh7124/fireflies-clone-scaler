"""FastAPI application entrypoint.

Phase 0: liveness endpoint only. Routers, database, seeding and engines land in
Phases 5-6 (see docs/05-ROADMAP.md).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Fireflies Clone API",
    version="0.1.0",
    description="Meeting notes & transcription platform — REST API",
)

# TODO(phase-5): move allowed origins to settings (CORS_ORIGINS env var).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health() -> dict:
    """Liveness + seed status. Full wiring (db counts, llm_enabled) lands in Phase 5."""
    return {"ok": True, "db": "pending", "meetings": 0, "seed": "pending", "llm_enabled": False}
