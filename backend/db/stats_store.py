"""Stats store — thread-safe, file-backed statistics with an in-memory write lock.

Design decisions:
- A module-level threading.Lock prevents the read-modify-write race condition
  that caused undercounting under concurrent requests.
- The stats file path is now resolved relative to this file, not the CWD,
  so it is stable across Docker / dev environments.
- All public functions are synchronous (cheap file I/O); callers that need
  async wrapping can use asyncio.to_thread.
"""
import json
import threading
from pathlib import Path

import structlog

logger = structlog.get_logger()

# Resolve stats path relative to the backend root, not the process CWD
_STATS_FILE = Path(__file__).parent.parent.parent / "vectorstore" / "stats.json"

_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Internal helpers (must be called with _lock held)
# ---------------------------------------------------------------------------

def _load() -> dict:
    if _STATS_FILE.exists():
        try:
            return json.loads(_STATS_FILE.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning("stats.json unreadable — resetting", error=str(e))
    return {
        "total_queries": 0,
        "total_latency_ms": 0.0,
        "documents_indexed": 0,
        "chunks_stored": 0,
        "repositories_indexed": 0,
    }


def _save(data: dict) -> None:
    _STATS_FILE.parent.mkdir(parents=True, exist_ok=True)
    # Write to a temp file then rename — atomic on POSIX, best-effort on Windows
    tmp = _STATS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(_STATS_FILE)


# ---------------------------------------------------------------------------
# Public API — all protected by _lock
# ---------------------------------------------------------------------------

def record_query(latency_ms: float) -> None:
    with _lock:
        data = _load()
        data["total_queries"] += 1
        data["total_latency_ms"] = data.get("total_latency_ms", 0.0) + latency_ms
        _save(data)


def increment_documents(count: int = 1) -> None:
    with _lock:
        data = _load()
        data["documents_indexed"] = data.get("documents_indexed", 0) + count
        _save(data)


def increment_chunks(count: int) -> None:
    with _lock:
        data = _load()
        data["chunks_stored"] = data.get("chunks_stored", 0) + count
        _save(data)


def increment_repositories(count: int = 1) -> None:
    with _lock:
        data = _load()
        data["repositories_indexed"] = data.get("repositories_indexed", 0) + count
        _save(data)


def get_stats() -> dict:
    with _lock:
        data = _load()
    total_queries = data.get("total_queries", 0)
    total_latency = data.get("total_latency_ms", 0.0)
    avg_latency = round(total_latency / total_queries, 1) if total_queries > 0 else 0.0
    return {
        "documents_indexed": data.get("documents_indexed", 0),
        "repositories_indexed": data.get("repositories_indexed", 0),
        "chunks_stored": data.get("chunks_stored", 0),
        "total_queries": total_queries,
        "avg_response_time_ms": avg_latency,
    }
