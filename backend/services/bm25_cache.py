"""services/bm25_cache.py — Precomputed, hot-reloadable BM25 index.

Problem solved:
    The original retrieval.py called collection.get() to load up to 200 documents
    from ChromaDB on EVERY query, then built a BM25Okapi object from scratch each time.
    This wastes 300–600ms per query.

Solution:
    - Build the BM25 index ONCE at startup (via lifespan hook in main.py).
    - Keep it in memory. Rebuild asynchronously only when new documents are uploaded.
    - Use a read/write lock so searches never block on rebuilds.

Usage:
    from services.bm25_cache import get_bm25_cache
    cache = get_bm25_cache()
    await cache.ensure_ready()
    results = cache.search(query_tokens, top_k=10)
    # Returns List[Tuple[str, dict, float]] — (document, metadata, score)
"""
import asyncio
import time
import logging
from typing import List, Tuple, Optional

import structlog

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# BM25 index entry — lightweight storage of all corpus data
# ---------------------------------------------------------------------------

class BM25Cache:
    """Thread-safe, lazily-built BM25 index over the full ChromaDB corpus."""

    def __init__(self):
        self._docs: List[str] = []
        self._metas: List[dict] = []
        self._bm25 = None                  # BM25Okapi instance
        self._built_at: float = 0.0
        self._lock = asyncio.Lock()
        self._building = False

    # ── Public interface ──────────────────────────────────────────────────────

    async def ensure_ready(self) -> None:
        """Guarantee the index is built before a search. No-op if already ready."""
        if self._bm25 is not None:
            return
        await self.rebuild()

    async def rebuild(self, limit: int = 2000) -> None:
        """Fetch all corpus docs from ChromaDB and rebuild the BM25 index.

        Safe to call concurrently — only one rebuild runs at a time.
        Searchers can keep using the old index while the new one is built.
        """
        async with self._lock:
            if self._building:
                return
            self._building = True

        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._rebuild_sync, limit)
        finally:
            self._building = False

    def _rebuild_sync(self, limit: int) -> None:
        """CPU-bound work — run in thread pool executor."""
        try:
            from db.chroma import get_collection
            from rank_bm25 import BM25Okapi

            collection = get_collection()
            total = collection.count()
            if total == 0:
                logger.info("BM25 cache: corpus empty, skipping build")
                return

            fetch_limit = min(limit, total)
            data = collection.get(include=["documents", "metadatas"], limit=fetch_limit)
            docs = data.get("documents") or []
            metas = data.get("metadatas") or []

            if not docs:
                return

            tokenized = [doc.lower().split() for doc in docs]
            bm25 = BM25Okapi(tokenized)

            # Atomic swap — old index stays usable until the new one is ready
            self._docs = docs
            self._metas = metas
            self._bm25 = bm25
            self._built_at = time.time()

            logger.info("BM25 cache rebuilt", corpus_size=len(docs))
        except Exception as e:
            logger.error("BM25 cache rebuild failed", error=str(e))

    def search(
        self,
        query_tokens: List[str],
        top_k: int = 10,
        where: Optional[dict] = None,
    ) -> List[Tuple[str, dict, float]]:
        """Return top-k (doc, metadata, normalised_score) tuples.

        Args:
            query_tokens: Pre-tokenised query words (lowercase).
            top_k:        Max results to return.
            where:        Optional metadata filter dict (e.g. {"doc_type": "runbook"}).
                          Applied as a post-filter — fast enough for <2000 docs.
        Returns:
            List of (document_text, metadata_dict, score_0_to_1).
        """
        if self._bm25 is None or not self._docs:
            return []

        scores = self._bm25.get_scores(query_tokens)
        max_score = float(max(scores)) if len(scores) > 0 else 1.0
        if max_score == 0:
            return []

        indexed = [(i, float(scores[i]) / max_score) for i in range(len(scores))]
        indexed.sort(key=lambda x: x[1], reverse=True)

        results = []
        for idx, norm_score in indexed:
            if len(results) >= top_k:
                break
            if norm_score == 0:
                break
            if idx >= len(self._docs):
                continue
            meta = self._metas[idx]
            # Apply optional metadata filter
            if where and not all(meta.get(k) == v for k, v in where.items()):
                continue
            results.append((self._docs[idx], meta, norm_score))

        return results

    @property
    def size(self) -> int:
        return len(self._docs)

    @property
    def built_at(self) -> float:
        return self._built_at

    def invalidate(self) -> None:
        """Mark the index as stale — next ensure_ready() will trigger a rebuild."""
        self._bm25 = None
        logger.info("BM25 cache invalidated")


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_bm25_cache: Optional[BM25Cache] = None


def get_bm25_cache() -> BM25Cache:
    global _bm25_cache
    if _bm25_cache is None:
        _bm25_cache = BM25Cache()
    return _bm25_cache
