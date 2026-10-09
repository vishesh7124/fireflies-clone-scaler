"""FastAPI application entrypoint (docs/03-LLD §2)."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.routers import action_items, engagement, meetings, meta, search, summaries


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables + seed demo data on startup (Phase 5)."""
    init_db()
    if settings.seed_on_start:
        try:
            from app.seed.seed import seed_all
            from app.database import SessionLocal
            with SessionLocal() as db:
                seed_all(db)
        except Exception as exc:  # don't block boot on seed errors
            print(f"[seed] skipped: {exc}")
    yield


app = FastAPI(
    title="Fireflies Clone API",
    version="0.5.0",
    description="Meeting notes & transcription platform — REST API",
    lifespan=lifespan,
)

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

# serve generated/uploaded media files (WAV audio for playback)
media_dir = Path(settings.media_dir)
media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_dir)), name="media")
