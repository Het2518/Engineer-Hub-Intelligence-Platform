"""Knowledge router — REST API for the OKF (Open Knowledge Format) knowledge layer.

Endpoints:
  GET  /knowledge/           → list all OKF documents
  GET  /knowledge/search     → search OKF bundle by query
  GET  /knowledge/types      → list all OKF types
  GET  /knowledge/tags       → list all tags with counts
  GET  /knowledge/{path:path} → get a specific OKF document
  POST /knowledge/           → create a new OKF document
  PUT  /knowledge/{path:path} → update an existing OKF document
  DELETE /knowledge/{path:path} → delete an OKF document
  POST /knowledge/reload     → force-reload the OKF cache
"""
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import structlog

from services.okf_reader import get_okf_reader, OKFDocument

logger = structlog.get_logger()
router = APIRouter(prefix="/knowledge", tags=["Knowledge"])


# ── Pydantic Models ───────────────────────────────────────────────────────────

class OKFDocumentSummary(BaseModel):
    source_id: str
    okf_type: str
    title: str
    description: str
    tags: list[str]
    resource: str
    timestamp: Optional[str]
    trust_level: str
    is_stale: bool
    category: str
    content_preview: str


class OKFDocumentFull(OKFDocumentSummary):
    content: str
    links: list[tuple[str, str]]
    provenance: dict
    trust: dict


class CreateDocumentRequest(BaseModel):
    okf_type: str
    title: str
    description: str = ""
    tags: list[str] = []
    content: str
    resource: str = ""
    trust_verified: bool = False
    author: str = ""


class UpdateDocumentRequest(BaseModel):
    title: str
    description: str = ""
    tags: list[str] = []
    content: str
    resource: str = ""
    trust_verified: bool = False
    author: str = ""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _doc_to_summary(doc: OKFDocument) -> OKFDocumentSummary:
    preview = doc.content[:300].strip()
    if len(doc.content) > 300:
        preview += "…"
    return OKFDocumentSummary(
        source_id=doc.source_id,
        okf_type=doc.okf_type,
        title=doc.title,
        description=doc.description,
        tags=doc.tags,
        resource=doc.resource,
        timestamp=str(doc.timestamp) if doc.timestamp else None,
        trust_level=doc.trust_level,
        is_stale=doc.is_stale,
        category=doc.category,
        content_preview=preview,
    )


def _doc_to_full(doc: OKFDocument) -> OKFDocumentFull:
    return OKFDocumentFull(
        source_id=doc.source_id,
        okf_type=doc.okf_type,
        title=doc.title,
        description=doc.description,
        tags=doc.tags,
        resource=doc.resource,
        timestamp=str(doc.timestamp) if doc.timestamp else None,
        trust_level=doc.trust_level,
        is_stale=doc.is_stale,
        category=doc.category,
        content_preview=doc.content[:300].strip(),
        content=doc.content,
        links=doc.links,
        provenance=doc.provenance,
        trust=doc.trust,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", summary="List all OKF documents")
async def list_documents(
    filter_type: Optional[str] = None,
    filter_tag: Optional[str] = None,
):
    """Return all OKF documents in the knowledge bundle (metadata only)."""
    reader = get_okf_reader()
    docs = await reader.all_documents()

    if filter_type:
        docs = [d for d in docs if d.okf_type.lower() == filter_type.lower()]
    if filter_tag:
        docs = [d for d in docs if filter_tag.lower() in [t.lower() for t in d.tags]]

    return {
        "count": len(docs),
        "documents": [_doc_to_summary(d) for d in docs],
    }



@router.get("/stats", summary="OKF knowledge bundle statistics")
async def knowledge_stats():
    """Return aggregate statistics for the OKF knowledge bundle."""
    from config import get_settings
    settings = get_settings()

    reader = get_okf_reader()
    docs = await reader.all_documents()

    by_type: dict[str, int] = {}
    by_trust: dict[str, int] = {}
    stale_count = 0

    for doc in docs:
        by_type[doc.okf_type] = by_type.get(doc.okf_type, 0) + 1
        by_trust[doc.trust_level] = by_trust.get(doc.trust_level, 0) + 1
        if doc.is_stale:
            stale_count += 1

    return {
        "total_documents": len(docs),
        "by_type": by_type,
        "by_trust": by_trust,
        "stale_count": stale_count,
        "trust_boost": settings.okf_trust_boost,
        "knowledge_dir": settings.okf_knowledge_dir,
    }


@router.get("/search", summary="Search OKF knowledge bundle")
async def search_knowledge(
    q: str,
    top_k: int = 5,
    filter_type: Optional[str] = None,
):
    """Search the OKF knowledge bundle by natural language query."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    reader = get_okf_reader()
    results = await reader.search(q.strip(), top_k=min(top_k, 20), filter_type=filter_type)

    return {
        "query": q,
        "count": len(results),
        "results": [
            {
                "source_id": r.document.source_id,
                "title": r.document.title,
                "okf_type": r.document.okf_type,
                "tags": r.document.tags,
                "confidence": r.confidence,
                "match_reason": r.match_reason,
                "trust_level": r.document.trust_level,
                "is_stale": r.document.is_stale,
                "content_preview": r.content_preview,
            }
            for r in results
        ],
    }


@router.get("/types", summary="List all OKF types in use")
async def list_types():
    """Return all distinct OKF document types present in the knowledge bundle."""
    reader = get_okf_reader()
    return {"types": await reader.all_types()}


@router.get("/tags", summary="List all tags with counts")
async def list_tags():
    """Return all tags and their document counts."""
    reader = get_okf_reader()
    return {"tags": await reader.all_tags()}


@router.post("/reload", summary="Force reload OKF cache")
async def reload_cache():
    """Force the OKF reader to re-scan the knowledge/ directory."""
    reader = get_okf_reader()
    reader.reload()
    docs = await reader.all_documents()
    return {"status": "reloaded", "document_count": len(docs)}


@router.post("/", summary="Create a new OKF document")
async def create_document(payload: CreateDocumentRequest):
    """Create a new OKF-compliant document in the knowledge bundle."""
    from services.okf_writer import create_okf_document

    valid_types = ["Runbook", "Playbook", "IncidentReport", "Architecture", "Standard", "Metric"]
    if payload.okf_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid OKF type. Valid types: {', '.join(valid_types)}"
        )

    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    source_id = await create_okf_document(
        okf_type=payload.okf_type,
        title=payload.title.strip(),
        description=payload.description.strip(),
        tags=payload.tags,
        content=payload.content.strip(),
        resource=payload.resource.strip(),
        trust_verified=payload.trust_verified,
        author=payload.author.strip(),
    )

    return {
        "status": "created",
        "source_id": source_id,
        "message": f"OKF document '{payload.title}' created successfully",
    }


@router.get("/{path:path}", summary="Get a specific OKF document")
async def get_document(path: str):
    """Get the full content of a specific OKF document by its path."""
    reader = get_okf_reader()
    doc = await reader.get_document(path)

    if not doc:
        raise HTTPException(status_code=404, detail=f"OKF document not found: {path}")

    linked = await reader.get_linked_documents(path)

    return {
        "document": _doc_to_full(doc),
        "linked_documents": [_doc_to_summary(d) for d in linked],
    }


@router.put("/{path:path}", summary="Update an OKF document")
async def update_document(path: str, payload: UpdateDocumentRequest):
    """Update the content and metadata of an existing OKF document."""
    from services.okf_writer import update_okf_document

    success = await update_okf_document(
        source_id=path,
        title=payload.title.strip(),
        description=payload.description.strip(),
        tags=payload.tags,
        content=payload.content.strip(),
        resource=payload.resource.strip(),
        trust_verified=payload.trust_verified,
        author=payload.author.strip(),
    )

    if not success:
        raise HTTPException(status_code=404, detail=f"OKF document not found: {path}")

    return {"status": "updated", "source_id": path}


@router.delete("/{path:path}", summary="Delete an OKF document")
async def delete_document(path: str):
    """Permanently delete an OKF document from the knowledge bundle."""
    from services.okf_writer import delete_okf_document

    success = await delete_okf_document(path)
    if not success:
        raise HTTPException(status_code=404, detail=f"OKF document not found: {path}")

    return {"status": "deleted", "source_id": path}
