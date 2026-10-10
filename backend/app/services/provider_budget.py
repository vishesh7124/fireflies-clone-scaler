"""Atomic UTC daily/minute request budgets with conservative token reservations.

Every retry reserves another request. Refund only confirmed unused tokens from
successful provider usage reports; unknown/failed usage keeps its reservation.
"""
import threading
import time
from datetime import datetime, timezone

from sqlalchemy import text


class BudgetExceeded(Exception):
    pass


class MemoryBudget:
    """No-DB implementation for isolated client tests and direct SDK use."""
    def __init__(self, config):
        self.config = config
        self.lock = threading.Lock()
        self.days = {}

    def reserve(self, tokens):
        day = datetime.now(timezone.utc).date().isoformat()
        minute = int(time.time() // 60)
        with self.lock:
            row = self.days.setdefault(day, {"requests": 0, "tokens": 0, "minute": minute, "minute_requests": 0})
            if row["minute"] != minute:
                row["minute"], row["minute_requests"] = minute, 0
            check(self.config, row["requests"], row["tokens"], row["minute_requests"], tokens)
            row["requests"] += 1
            row["minute_requests"] += 1
            row["tokens"] += tokens
        return day, tokens

    def settle(self, reservation, used):
        if not valid_usage(reservation[1], used):
            return
        with self.lock:
            self.days[reservation[0]]["tokens"] -= reservation[1] - used


class SQLiteBudget:
    """Shared daily/minute quotas survive API restarts and share the SQLite file."""
    def __init__(self, config, sessions=None):
        if sessions is None:
            from app.database import SessionLocal
            sessions = SessionLocal
        self.config, self.sessions = config, sessions

    def reserve(self, tokens):
        from app.models import ProviderUsage
        day = datetime.now(timezone.utc).date().isoformat()
        minute = int(time.time() // 60)
        with self.sessions() as db:
            db.execute(text("BEGIN IMMEDIATE"))
            row = db.get(ProviderUsage, day)
            if row is None:
                row = ProviderUsage(day=day, requests=0, tokens=0, minute=minute, minute_requests=0)
                db.add(row)
            if row.minute != minute:
                row.minute, row.minute_requests = minute, 0
            check(self.config, row.requests, row.tokens, row.minute_requests, tokens)
            row.requests += 1
            row.minute_requests += 1
            row.tokens += tokens
            db.commit()
        return day, tokens

    def settle(self, reservation, used):
        from app.models import ProviderUsage
        if not valid_usage(reservation[1], used):
            return
        with self.sessions() as db:
            db.execute(text("BEGIN IMMEDIATE"))
            row = db.get(ProviderUsage, reservation[0])
            if row is not None:
                row.tokens = max(0, row.tokens - (reservation[1] - used))
            db.commit()


def check(config, requests, tokens, minute_requests, reservation):
    if requests >= config.llm_requests_per_day or minute_requests >= config.llm_requests_per_minute or tokens + reservation > config.llm_tokens_per_day:
        raise BudgetExceeded()


def valid_usage(reserved, used):
    return type(used) is int and 0 <= used <= reserved
