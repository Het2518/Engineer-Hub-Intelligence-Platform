"""Embedding service — async, non-blocking, thread-pool isolated.

Uses ChromaDB's DefaultEmbeddingFunction (all-MiniLM-L6-v2, 384-dim) so the
embedded vectors are always consistent with what ChromaDB stores.  The call is
run in a thread-pool executor via asyncio.to_thread so it never blocks the
uvicorn event loop.
"""
import asyncio
from typing import List

import chromadb.utils.embedding_functions as embedding_functions
import structlog

from config import get_settings

logger = structlog.get_logger()
settings = get_settings()

_ef = None


def _get_embedding_function():
    global _ef
    if _ef is None:
        _ef = embedding_functions.DefaultEmbeddingFunction()
    return _ef


def _embed_batch_sync(texts: List[str]) -> List[List[float]]:
    """Synchronous embedding call — intended to run inside a thread pool."""
    ef = _get_embedding_function()
    return ef(texts)


from langsmith import traceable

@traceable
async def embed_texts(texts: List[str], batch_size: int = 64) -> List[List[float]]:
    """Generate embeddings for a list of texts.

    Batching is applied so the thread pool isn't handed an unbounded list.
    Each batch runs in a thread-pool worker so the event loop stays responsive.
    """
    if not texts:
        return []

    all_embeddings: List[List[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = [t.replace("\n", " ").strip() for t in texts[i : i + batch_size] if t.strip()]
        if not batch:
            continue
        try:
            # asyncio.to_thread is the idiomatic Python 3.9+ way to avoid
            # blocking the event loop with synchronous CPU/IO work.
            batch_embeddings = await asyncio.to_thread(_embed_batch_sync, batch)
            all_embeddings.extend(batch_embeddings)
            logger.debug("Embedded batch", batch_num=i // batch_size + 1, count=len(batch))
        except Exception as e:
            logger.error("Embedding failed", error=str(e), batch_start=i)
            raise

    return all_embeddings


@traceable
async def embed_query(text: str) -> List[float]:
    """Embed a single query string."""
    embeddings = await embed_texts([text])
    if embeddings:
        return embeddings[0]
    raise ValueError("Failed to generate query embedding")
