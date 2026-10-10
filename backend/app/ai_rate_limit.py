"""Small per-process AI endpoint throttle. Never trusts raw forwarded headers."""

import hashlib
import re
import threading
import time
from collections import OrderedDict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class AIRateLimiter:
    def __init__(self, limit, clock=time.monotonic):
        self.limit, self.clock = limit, clock
        self.buckets = OrderedDict()
        self.lock = threading.Lock()

    def allow(self, host):
        key = hashlib.sha256(host.encode()).hexdigest()
        now = self.clock()
        with self.lock:
            bucket = self.buckets.get(key)
            if bucket is None or now - bucket[0] >= 60:
                bucket = [now, 0]
                self.buckets[key] = bucket
            self.buckets.move_to_end(key)
            while len(self.buckets) > 2048:
                self.buckets.popitem(last=False)
            if bucket[1] >= self.limit:
                return False
            bucket[1] += 1
            return True


class AIRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit):
        super().__init__(app)
        self.limiter = AIRateLimiter(limit)

    async def dispatch(self, request, call_next):
        path = request.url.path
        ai_post = request.method == "POST" and (path in {"/api/v1/chat", "/api/v1/meetings"} or
            re.fullmatch(r"/api/v1/meetings/\d+/(chat|regenerate)", path))
        if ai_post and not self.limiter.allow(request.client.host if request.client else "unknown"):
            return JSONResponse({"detail": "Too many AI requests. Please retry in a minute."}, status_code=429,
                                headers={"Retry-After": "60"})
        return await call_next(request)
