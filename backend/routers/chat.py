"""POST /chat — Streaming RAG chat endpoint with input validation.

V2 additions:
- DELETE /chat/sessions/{id}  — delete a session
- PATCH  /chat/sessions/{id}  — rename a session
- SSE 'thinking' event before tokens (shows retrieval progress in UI)
- 'context_used' count in done event
- OKF-aware source formatting (is_okf flag)
"""
import json
import time
from typing import Optional, AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services.retrieval import hybrid_search, RetrievalResult
from services.llm import stream_answer
from services.memory import get_all_sessions, get_history, delete_session, rename_session
from services.query_rewriter import rewrite_query
from db.stats_store import record_query
import structlog

logger = structlog.get_logger()
router = APIRouter()

MAX_QUESTION_LENGTH = 4000


class AttachedFile(BaseModel):
    filename: str
    content: str
    mime_type: Optional[str] = None

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=MAX_QUESTION_LENGTH)
    stream: bool = True
    filter_doc_type: Optional[str] = None
    session_id: Optional[str] = None
    attached_files: Optional[list[AttachedFile]] = None


class RenameRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)


class Source(BaseModel):
    filename: str
    doc_type: str
    confidence: int
    content_preview: str
    is_okf: bool = False
    trust_level: str = ""
    okf_type: str = ""
    match_reason: str = ""


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    response_time_ms: float


def _format_sources(results: list[RetrievalResult]) -> list[Source]:
    seen = set()
    sources = []
    for r in results:
        key = r.source
        if key not in seen:
            seen.add(key)
            preview = r.content[:200].strip()
            if len(r.content) > 200:
                preview += "..."
            is_okf = bool(r.metadata.get("is_okf"))
            sources.append(
                Source(
                    filename=r.source,
                    doc_type=r.doc_type,
                    confidence=r.confidence,
                    content_preview=preview,
                    is_okf=is_okf,
                    trust_level=r.metadata.get("trust_level", "") if is_okf else "",
                    okf_type=r.metadata.get("okf_type", "") if is_okf else "",
                    match_reason=r.metadata.get("match_reason", "") if is_okf else "",
                )
            )
    return sources


from limiter import limiter
from fastapi import Request

@router.post("/chat")
@limiter.limit("20/minute")
async def chat(request: Request, payload: ChatRequest):
    """Answer a question using RAG + OKF hybrid search with optional SSE streaming."""
    if not payload.question.strip():
        return {"error": "Question cannot be empty"}

    start = time.time()
    search_query = payload.question

    if payload.session_id:
        history = await get_history(payload.session_id)
        if history:
            search_query = await rewrite_query(payload.question, history)

    results = await hybrid_search(
        question=search_query,
        filter_doc_type=payload.filter_doc_type,
    )
    sources = _format_sources(results)
    
    attached_dicts = [f.model_dump() for f in payload.attached_files] if payload.attached_files else None

    if payload.stream:
        return StreamingResponse(
            _stream_response(payload.question, results, sources, start, payload.session_id, attached_dicts),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # Non-streaming path
    full_answer = ""
    async for chunk in stream_answer(payload.question, results, payload.session_id, attached_dicts):
        full_answer += chunk

    elapsed = (time.time() - start) * 1000
    record_query(elapsed)

    return ChatResponse(
        answer=full_answer,
        sources=sources,
        response_time_ms=round(elapsed, 1),
    )


async def _stream_response(
    question: str,
    results: list[RetrievalResult],
    sources: list[Source],
    start: float,
    session_id: Optional[str] = None,
    attached_files: Optional[list[dict]] = None,
) -> AsyncIterator[str]:
    """SSE event generator for streaming responses."""

    # 0. Thinking event — shows retrieval stage in UI before tokens arrive
    okf_count = sum(1 for r in results if r.metadata.get("is_okf"))
    rag_count  = len(results) - okf_count
    yield f"data: {json.dumps({'type': 'thinking', 'okf_sources': okf_count, 'rag_sources': rag_count, 'total': len(results)})}\n\n"

    # 1. Send sources immediately so the UI can render them while the LLM streams
    yield f"data: {json.dumps({'type': 'sources', 'sources': [s.model_dump() for s in sources]})}\n\n"

    # 2. Stream answer tokens
    try:
        async for token in stream_answer(question, results, session_id, attached_files):
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
    except Exception as e:
        logger.error("Streaming error", error=str(e))
        yield f"data: {json.dumps({'type': 'error', 'message': 'Stream interrupted. Please retry.'})}\n\n"

    # 3. Done event
    elapsed = (time.time() - start) * 1000
    record_query(elapsed)
    yield f"data: {json.dumps({'type': 'done', 'response_time_ms': round(elapsed, 1), 'context_used': len(results), 'okf_sources': okf_count})}\n\n"
    yield "data: [DONE]\n\n"


# ── Session Management ────────────────────────────────────────────────────────

@router.get("/chat/sessions")
async def list_sessions():
    """Get all past chat sessions."""
    return await get_all_sessions()


@router.get("/chat/sessions/{session_id}")
async def get_session_history(session_id: str):
    """Get message history for a specific session."""
    return {"messages": await get_history(session_id)}


@router.delete("/chat/sessions/{session_id}")
async def delete_chat_session(session_id: str):
    """Delete a session and all its messages."""
    success = await delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    return {"status": "deleted", "session_id": session_id}


@router.patch("/chat/sessions/{session_id}")
async def rename_chat_session(session_id: str, payload: RenameRequest):
    """Rename a chat session."""
    success = await rename_session(session_id, payload.title.strip())
    if not success:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    return {"status": "renamed", "session_id": session_id, "title": payload.title.strip()}
