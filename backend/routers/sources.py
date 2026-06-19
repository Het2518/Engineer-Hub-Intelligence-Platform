"""GET /sources — List all indexed documents."""
from fastapi import APIRouter
from pydantic import BaseModel
from db.chroma import get_all_documents_metadata, get_total_chunks
import structlog

logger = structlog.get_logger()
router = APIRouter()


class SourceItem(BaseModel):
    source: str
    filename: str
    doc_type: str
    indexed_at: str


class SourcesResponse(BaseModel):
    sources: list[SourceItem]
    total_chunks: int


@router.get("/sources", response_model=SourcesResponse)
async def get_sources() -> SourcesResponse:
    """Return all unique indexed document sources."""
    metas = get_all_documents_metadata()
    sources = [
        SourceItem(
            source=m.get("source", ""),
            filename=m.get("filename", ""),
            doc_type=m.get("doc_type", "document"),
            indexed_at=m.get("indexed_at", ""),
        )
        for m in metas
    ]
    total = get_total_chunks()
    return SourcesResponse(sources=sources, total_chunks=total)
