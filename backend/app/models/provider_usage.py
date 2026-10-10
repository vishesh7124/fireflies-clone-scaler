"""Persistent provider quotas contain counters only, never keys or prompt content."""
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ProviderUsage(Base):
    __tablename__ = "provider_usage"
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    requests: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    minute: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    minute_requests: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
