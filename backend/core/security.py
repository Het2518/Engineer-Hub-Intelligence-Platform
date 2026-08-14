"""core/security.py — API key authentication dependency.

Extracted from main.py so it can be shared cleanly across routers
without importing from the application entry point.
"""
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import get_settings

security = HTTPBearer(auto_error=False)
settings = get_settings()


def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> None:
    """FastAPI dependency — validates Bearer token against API_KEY env var.

    If API_KEY is not configured (empty string) the check is skipped,
    which is the correct behaviour for local / open deployments.
    """
    if not settings.api_key:
        return
    if not credentials or credentials.credentials != settings.api_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API Key",
            headers={"WWW-Authenticate": "Bearer"},
        )
