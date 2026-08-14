"""POST /chat — Streaming RAG chat endpoint (V3 — latency optimised).

V3 additions:
- Semantic cache: identical/similar queries return in ~50ms instead of 6-9s
- Adaptive query router: skips LLM rewriter for simple queries (saves 800-1200ms)
- SSE 'cache_hit' event: frontend shows ⚡ instant badge on cached responses
- SSE 'pipeline_stage' events: real-time pipeline progress for the UI
- Per-stage latency timing for analytics
- 'context_used' count in done event
- OKF-aware source formatting (is_okf flag)
"""
import json
import time
from typing import Optional, AsyncIterator
import numpy as np

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from schemas.chat import (
    AttachedFile,
    ChatRequest,
    ChatResponse,
    RenameRequest,
    Source,
)
from services.retrieval import hybrid_search, RetrievalResult
from services.llm import stream_answer
from services.memory import get_all_sessions, get_history, delete_session, rename_session
from services.query_router import classify_query, QueryTier
from services.semantic_cache import get_semantic_cache
from services.embedding import embed_query
from db.stats_store import record_query
from core.limiter import limiter
import structlog

logger = structlog.get_logger()
router = APIRouter()


# ── Source formatting ─────────────────────────────────────────────────────────

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


# ── Main chat endpoint ────────────────────────────────────────────────────────

@router.post("/chat")
@limiter.limit("20/minute")
async def chat(request: Request, payload: ChatRequest):
    """Answer a question using V3 RAG: semantic cache → adaptive routing → hybrid RAG."""
    if not payload.question.strip():
        return {"error": "Question cannot be empty"}

    from config import get_settings
    settings = get_settings()
    start = time.time()

    # ── 1. Semantic Cache check ────────────────────────────────────────────────
    query_embedding: Optional[np.ndarray] = None
    if settings.semantic_cache_enabled and not payload.attached_files:
        try:
            query_embedding = np.array(await embed_query(payload.question), dtype=np.float32)
            cache = get_semantic_cache()
            cached_entry = await cache.lookup(query_embedding)
            if cached_entry:
                logger.info("Semantic cache hit", latency_ms=round((time.time() - start) * 1000, 1))
                if payload.stream:
                    return StreamingResponse(
                        _stream_cache_hit(cached_entry, start),
                        media_type="text/event-stream",
                        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
                    )
                return ChatResponse(
                    answer=cached_entry.answer,
                    sources=[Source(**s) for s in cached_entry.sources],
                    response_time_ms=round((time.time() - start) * 1000, 1),
                )
        except Exception as e:
            logger.warning("Semantic cache lookup failed, continuing", error=str(e))

    # ── 2. Adaptive Query Router ───────────────────────────────────────────────
    search_query = payload.question
    history = []
    if payload.session_id:
        history = await get_history(payload.session_id)

    tier = QueryTier.NORMAL
    if settings.smart_router_enabled:
        tier = classify_query(
            payload.question,
            has_session_history=bool(history),
            max_simple_chars=settings.simple_query_max_chars,
        )

    # Only COMPLEX queries get the LLM rewriter (saves 800–1200ms for FAST/NORMAL)
    if tier == QueryTier.COMPLEX and history:
        from services.query_rewriter import rewrite_query
        search_query = await rewrite_query(payload.question, history)

    # ── 3. Hybrid RAG retrieval ───────────────────────────────────────────────
    results = await hybrid_search(
        question=search_query,
        filter_doc_type=payload.filter_doc_type,
    )
    sources = _format_sources(results)
    attached_dicts = [f.model_dump() for f in payload.attached_files] if payload.attached_files else None

    if payload.stream:
        return StreamingResponse(
            _stream_response(
                payload.question, results, sources, start,
                payload.session_id, attached_dicts,
                query_embedding=query_embedding,
                tier=tier,
            ),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # Non-streaming path
    full_answer = ""
    async for chunk in stream_answer(payload.question, results, payload.session_id, attached_dicts):
        full_answer += chunk

    elapsed = (time.time() - start) * 1000
    record_query(elapsed)

    # Store in semantic cache
    if settings.semantic_cache_enabled and query_embedding is not None and not payload.attached_files:
        try:
            await get_semantic_cache().store(
                query_embedding=query_embedding,
                answer=full_answer,
                sources=[s.model_dump() for s in sources],
                response_time_ms=elapsed,
            )
        except Exception as e:
            logger.warning("Cache store failed", error=str(e))

    return ChatResponse(
        answer=full_answer,
        sources=sources,
        response_time_ms=round(elapsed, 1),
    )


# ── SSE stream generators ─────────────────────────────────────────────────────

async def _stream_cache_hit(cached_entry, start: float) -> AsyncIterator[str]:
    """SSE replay of a cached response — returns in ~50ms."""
    elapsed = (time.time() - start) * 1000

    # Instant cache-hit badge for the frontend
    yield f"data: {json.dumps({'type': 'cache_hit', 'similarity': 1.0})}\\n\\n"

    # Sources
    yield f"data: {json.dumps({'type': 'sources', 'sources': cached_entry.sources})}\\n\\n"

    # Replay the full answer as a single token chunk (no need to split)
    yield f"data: {json.dumps({'type': 'token', 'content': cached_entry.answer})}\\n\\n"

    # Done
    record_query(elapsed)
    yield f"data: {json.dumps({'type': 'done', 'response_time_ms': round(elapsed, 1), 'context_used': len(cached_entry.sources), 'okf_sources': 0, 'cache_hit': True})}\\n\\n"
    yield "data: [DONE]\\n\\n"


async def _stream_response(
    question: str,
    results: list[RetrievalResult],
    sources: list[Source],
    start: float,
    session_id: Optional[str] = None,
    attached_files: Optional[list[dict]] = None,
    query_embedding: Optional[np.ndarray] = None,
    tier: QueryTier = QueryTier.NORMAL,
) -> AsyncIterator[str]:
    """SSE event generator for streaming responses with pipeline stage events."""

    # 0. Pipeline stage — thinking/retrieval progress
    okf_count = sum(1 for r in results if r.metadata.get("is_okf"))
    rag_count  = len(results) - okf_count
    yield f"data: {json.dumps({'type': 'thinking', 'okf_sources': okf_count, 'rag_sources': rag_count, 'total': len(results), 'tier': tier.value})}\\n\\n"

    # 1. Pipeline stage — sources ready
    yield f"data: {json.dumps({'type': 'sources', 'sources': [s.model_dump() for s in sources]})}\\n\\n"

    # 2. Stream answer tokens
    full_answer = ""
    try:
        async for token in stream_answer(question, results, session_id, attached_files):
            full_answer += token
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\\n\\n"
    except Exception as e:
        logger.error("Streaming error", error=str(e))
        yield f"data: {json.dumps({'type': 'error', 'message': 'Stream interrupted. Please retry.'})}\\n\\n"

    # 3. Store in semantic cache (non-blocking)
    from config import get_settings
    settings = get_settings()
    if settings.semantic_cache_enabled and query_embedding is not None and full_answer and not attached_files:
        try:
            await get_semantic_cache().store(
                query_embedding=query_embedding,
                answer=full_answer,
                sources=[s.model_dump() for s in sources],
                response_time_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            logger.warning("Cache store failed (non-critical)", error=str(e))

    # 4. Done event
    elapsed = (time.time() - start) * 1000
    record_query(elapsed)
    yield f"data: {json.dumps({'type': 'done', 'response_time_ms': round(elapsed, 1), 'context_used': len(results), 'okf_sources': okf_count, 'cache_hit': False, 'tier': tier.value})}\\n\\n"
    yield "data: [DONE]\\n\\n"


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
