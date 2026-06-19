"""POST /chat — Streaming RAG chat endpoint using SSE."""
import json
import time
from typing import Optional, AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.retrieval import hybrid_search, RetrievalResult
from services.llm import stream_answer, parse_knowledge_cards, strip_knowledge_cards
from db.stats_store import record_query
import structlog

logger = structlog.get_logger()
router = APIRouter()


class ChatRequest(BaseModel):
    question: str
    stream: bool = True
    filter_doc_type: Optional[str] = None


class Source(BaseModel):
    filename: str
    doc_type: str
    confidence: int
    content_preview: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    knowledge_cards: list[dict]
    response_time_ms: float


def _format_sources(results: list[RetrievalResult]) -> list[Source]:
    seen = set()
    sources = []
    for r in results:
        key = r.source
        if key not in seen:
            seen.add(key)
            sources.append(
                Source(
                    filename=r.source,
                    doc_type=r.doc_type,
                    confidence=r.confidence,
                    content_preview=r.content[:200].strip() + "..." if len(r.content) > 200 else r.content,
                )
            )
    return sources


@router.post("/chat")
async def chat(request: ChatRequest):
    """Answer a question using RAG with optional SSE streaming."""
    if not request.question.strip():
        return {"error": "Question cannot be empty"}

    start = time.time()

    # Retrieve relevant context
    results = await hybrid_search(
        question=request.question,
        filter_doc_type=request.filter_doc_type,
    )
    sources = _format_sources(results)

    if request.stream:
        return StreamingResponse(
            _stream_response(request.question, results, sources, start),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )
    else:
        # Non-streaming: collect full response
        full_answer = ""
        async for chunk in stream_answer(request.question, results):
            full_answer += chunk

        elapsed = (time.time() - start) * 1000
        record_query(elapsed)

        cards = parse_knowledge_cards(full_answer)
        clean_answer = strip_knowledge_cards(full_answer)

        return ChatResponse(
            answer=clean_answer,
            sources=sources,
            knowledge_cards=cards,
            response_time_ms=round(elapsed, 1),
        )


async def _stream_response(
    question: str,
    results: list[RetrievalResult],
    sources: list[Source],
    start: float,
) -> AsyncIterator[str]:
    """SSE event generator for streaming responses."""

    # First event: sources
    sources_payload = json.dumps({
        "type": "sources",
        "sources": [s.model_dump() for s in sources],
    })
    yield f"data: {sources_payload}\n\n"

    # Stream answer tokens
    full_answer = ""
    async for token in stream_answer(question, results):
        full_answer += token
        token_payload = json.dumps({"type": "token", "content": token})
        yield f"data: {token_payload}\n\n"

    # Extract and send knowledge cards
    cards = parse_knowledge_cards(full_answer)
    elapsed = (time.time() - start) * 1000
    record_query(elapsed)

    done_payload = json.dumps({
        "type": "done",
        "knowledge_cards": cards,
        "response_time_ms": round(elapsed, 1),
    })
    yield f"data: {done_payload}\n\n"
    yield "data: [DONE]\n\n"
