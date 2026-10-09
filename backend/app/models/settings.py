"""App settings — single-row table (docs/03-LLD §1.3)."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Settings(Base):
    __tablename__ = "settings"
    __table_args__ = (CheckConstraint("id = 1", name="settings_single_row"),)

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    theme: Mapped[str] = mapped_column(String(16), default="dark")
    default_summary_template: Mapped[str] = mapped_column(String(20), default="general")
    default_playback_speed: Mapped[float] = mapped_column(Float, default=1.0)
    auto_join_meetings: Mapped[bool] = mapped_column(Boolean, default=True)
    send_recaps_to: Mapped[str] = mapped_column(String(32), default="everyone")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
