"""FastAPI application entrypoint (docs/03-LLD §2)."""

from contextlib import asynccontextmanager
from pathlib import Path
import httpx

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.services.llm_client import LLMClient
from app.services.provider_budget import SQLiteBudget
from app.services.retrieval_inference import Inference
from app.services.retrieval_indexer import Indexer, IndexWorker
from app.services.hybrid_retrieval import Retriever
from starlette.concurrency import run_in_threadpool
from app.ai_rate_limit import AIRateLimitMiddleware
from app.routers import action_items, engagement, meetings, meta, search, summaries, tags


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables + seed demo data on startup (Phase 5)."""
    init_db()
    if settings.seed_on_start:
        try:
            from app.seed.seed import seed_if_empty
            from app.database import SessionLocal
            with SessionLocal() as db:
                seed_if_empty(db)
        except Exception as exc:  # don't block boot on seed errors
            print(f"[seed] skipped: {exc}")
    # Shared connections, closed on shutdown. Creating this client sends no data.
    async with httpx.AsyncClient(trust_env=False, limits=httpx.Limits(
        max_connections=10, max_keepalive_connections=5,
    )) as http:
        app.state.llm_client = LLMClient(settings, http, SQLiteBudget(settings))
        inference = Inference(settings)
        app.state.retriever = Retriever(settings, inference)
        worker = IndexWorker(Indexer(settings, inference)) if settings.rag_indexing_enabled else None
        if worker:
            worker.start()
        try:
            yield
        finally:
            if worker:
                await run_in_threadpool(worker.stop)
            inference.close()


app = FastAPI(
    title="Fireflies Clone API",
    version="0.5.0",
    description="Meeting notes & transcription platform — REST API",
    lifespan=lifespan,
)

app.add_middleware(AIRateLimitMiddleware, limit=settings.ai_requests_per_ip_minute)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# mount all routers under /api/v1
app.include_router(meta.router, prefix="/api/v1")
app.include_router(meetings.router, prefix="/api/v1")
app.include_router(summaries.router, prefix="/api/v1")
app.include_router(action_items.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(engagement.router, prefix="/api/v1")
app.include_router(tags.router, prefix="/api/v1")

# serve generated/uploaded media files (WAV audio for playback)
media_dir = Path(settings.media_dir)
media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_dir)), name="media")
