"""SQLite engine + session factory (WAL mode for concurrent reads)."""

import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def _ensure_parent(path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)


# sqlite:/// prefix required by SQLAlchemy
DATABASE_URL = f"sqlite:///{settings.fi_reflies_db_path}"
_ensure_parent(settings.fi_reflies_db_path)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection: sqlite3.Connection, _record) -> None:
    """Enable WAL + foreign keys on every new connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
    # No virtual vector tables: core CRUD still works if extensions are unavailable.
    try:
        import sqlite_vec
        dbapi_connection.enable_load_extension(True)
        sqlite_vec.load(dbapi_connection)
    except (ImportError, AttributeError, sqlite3.Error):
        pass  # semantic retrieval detects availability and falls back to keywords
    finally:
        if hasattr(dbapi_connection, "enable_load_extension"):
            try:
                dbapi_connection.enable_load_extension(False)
            except sqlite3.Error:
                pass


SessionLocal = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)


def get_db():
    """FastAPI dependency — yields a scoped session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables (used before Alembic runs, and in tests)."""
    from app import models  # noqa: F401 — ensure models are registered

    Base.metadata.create_all(engine)
    from app.services.retrieval_schema import init_retrieval_schema
    init_retrieval_schema(engine)
