import time
import logging
from collections import defaultdict
from fastapi import Request, HTTPException, status

logger = logging.getLogger(__name__)

class InMemoryRateLimiter:
    def __init__(self, requests_limit: int, window_seconds: int):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self.history = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        # Clean up old timestamps
        cutoff = now - self.window_seconds
        self.history[key] = [t for t in self.history[key] if t > cutoff]
        
        if len(self.history[key]) < self.requests_limit:
            self.history[key].append(now)
            return True
        return False

# Global dictionary of limiters per route/action
_limiters = {}

def rate_limit(limit: int, window: int):
    """
    FastAPI dependency for rate limiting.
    Limits requests per client IP address.
    """
    def dependency(request: Request):
        # Determine the client identifier
        # Try to extract from X-Forwarded-For if behind a proxy
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown-ip"
            
        path = request.url.path
        key = f"{ip}:{path}"
        
        # Get or create the limiter for this path
        if path not in _limiters:
            _limiters[path] = InMemoryRateLimiter(limit, window)
            
        limiter = _limiters[path]
        if not limiter.is_allowed(key):
            logger.warning("Rate limit exceeded for key %s", key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
            )
    return dependency
