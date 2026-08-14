"""core/limiter.py — Global rate limiter instance.

Centralised here so it can be imported by main.py (for app setup)
and by any router that needs @limiter.limit() without a circular import.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Global rate limiter using client IP address
limiter = Limiter(key_func=get_remote_address)
