"""GET /stats — Real system statistics for the admin dashboard."""
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
    # Evaluation metrics are only populated when RAGAS / TruLens is configured.
    # Returning null is honest; hardcoding 92.4 is not.
    eval_retrieval_precision: float | None = None
    eval_answer_relevance: float | None = None


@router.get("/stats", response_model=StatsResponse)
async def get_system_stats() -> StatsResponse:
    """Return real system-wide statistics from the persistent store."""
    data = get_stats()
    # Sync chunks_stored with the actual ChromaDB count so the dashboard
    # always reflects what is actually indexed, not what the counter claims.
    actual_chunks = get_total_chunks()
    return StatsResponse(
        documents_indexed=data["documents_indexed"],
        repositories_indexed=data["repositories_indexed"],
        chunks_stored=actual_chunks,
        total_queries=data["total_queries"],
        avg_response_time_ms=data["avg_response_time_ms"],
        eval_retrieval_precision=data.get("eval_retrieval_precision"),
        eval_answer_relevance=data.get("eval_answer_relevance"),
    )


from fastapi import BackgroundTasks
from services.evaluation import run_ragas_evaluation

@router.post("/stats/evaluate")
async def trigger_evaluation(background_tasks: BackgroundTasks):
    """Trigger a background job to evaluate recent RAG responses."""
    background_tasks.add_task(run_ragas_evaluation)
    return {"message": "Evaluation job started in the background"}
