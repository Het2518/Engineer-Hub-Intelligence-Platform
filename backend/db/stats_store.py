import os
import json
import time
from pathlib import Path
from typing import Optional
import structlog

logger = structlog.get_logger()

STATS_FILE = Path("./vectorstore/stats.json")


def _load() -> dict:
    if STATS_FILE.exists():
        try:
            return json.loads(STATS_FILE.read_text())
        except Exception:
            pass
    return {
        "total_queries": 0,
        "total_latency_ms": 0,
        "documents_indexed": 0,
        "chunks_stored": 0,
        "repositories_indexed": 0,
    }


def _save(data: dict):
    STATS_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATS_FILE.write_text(json.dumps(data, indent=2))


def record_query(latency_ms: float):
    data = _load()
    data["total_queries"] += 1
    data["total_latency_ms"] += latency_ms
    _save(data)


def increment_documents(count: int = 1):
    data = _load()
    data["documents_indexed"] += count
    _save(data)


def increment_chunks(count: int):
    data = _load()
    data["chunks_stored"] += count
    _save(data)


def increment_repositories(count: int = 1):
    data = _load()
    data["repositories_indexed"] += count
    _save(data)


def get_stats() -> dict:
    data = _load()
    total_queries = data.get("total_queries", 0)
    total_latency = data.get("total_latency_ms", 0)
    avg_latency = round(total_latency / total_queries, 1) if total_queries > 0 else 0
    return {
        "documents_indexed": data.get("documents_indexed", 0),
        "repositories_indexed": data.get("repositories_indexed", 0),
        "chunks_stored": data.get("chunks_stored", 0),
        "total_queries": total_queries,
        "avg_response_time_ms": avg_latency,
    }
