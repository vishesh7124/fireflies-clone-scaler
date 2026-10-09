"""AI summary output — summary → sections → items (docs/03-LLD §1.3)."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Summary(Base):
    __tablename__ = "summaries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    template: Mapped[str] = mapped_column(String(20), default="general")
    generated_by: Mapped[str] = mapped_column(String(20), default="seed")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class SummarySection(Base):
    __tablename__ = "summary_sections"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    summary_id: Mapped[int] = mapped_column(ForeignKey("summaries.id", ondelete="CASCADE"), nullable=False)
    section_type: Mapped[str] = mapped_column(String(32), nullable=False)
    heading: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class SummaryItem(Base):
    __tablename__ = "summary_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("summary_sections.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(String, nullable=False)
    timestamp_ms: Mapped[int | None] = mapped_column(Integer)
    end_timestamp_ms: Mapped[int | None] = mapped_column(Integer)
    source_segment_id: Mapped[int | None] = mapped_column(ForeignKey("transcript_segments.id", ondelete="SET NULL"))
    order_index: Mapped[int] = mapped_column(Integer, default=0)
