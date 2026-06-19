"""GET /stats — System statistics for the admin dashboard."""
from fastapi import APIRouter
from pydantic import BaseModel
from db.stats_store import get_stats
from db.chroma import get_total_chunks
import structlog

logger = structlog.get_logger()
router = APIRouter()


class StatsResponse(BaseModel):
    documents_indexed: int
    repositories_indexed: int
    chunks_stored: int
    total_queries: int
    avg_response_time_ms: float


@router.get("/stats", response_model=StatsResponse)
async def get_system_stats() -> StatsResponse:
    """Return system-wide statistics."""
    data = get_stats()
    # Sync chunks_stored with actual ChromaDB count
    actual_chunks = get_total_chunks()
    return StatsResponse(
        documents_indexed=data["documents_indexed"],
        repositories_indexed=data["repositories_indexed"],
        chunks_stored=actual_chunks,
        total_queries=data["total_queries"],
        avg_response_time_ms=data["avg_response_time_ms"],
    )
