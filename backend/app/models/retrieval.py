"""Derived retrieval data. Original transcripts remain the source of truth."""

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from datetime import datetime


class RetrievalState(Base):
    __tablename__ = "retrieval_states"
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    indexed_revision: Mapped[int] = mapped_column(Integer, default=-1, nullable=False)
    profile: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    vector_model: Mapped[str | None] = mapped_column(String(300))
    error_reason: Mapped[str | None] = mapped_column(String(40))
    attempted_at: Mapped[datetime | None] = mapped_column(DateTime)


class RetrievalChunk(Base):
    __tablename__ = "retrieval_chunks"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    segment_ids: Mapped[str] = mapped_column(Text, nullable=False)  # ordered JSON IDs
    start_ms: Mapped[int | None] = mapped_column(Integer)
    end_ms: Mapped[int | None] = mapped_column(Integer)


class RetrievalEmbedding(Base):
    __tablename__ = "retrieval_embeddings"
    chunk_id: Mapped[int] = mapped_column(ForeignKey("retrieval_chunks.id", ondelete="CASCADE"), primary_key=True)
    model: Mapped[str] = mapped_column(String(300), index=True, nullable=False)
    dimensions: Mapped[int] = mapped_column(Integer, nullable=False)
    vector: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
