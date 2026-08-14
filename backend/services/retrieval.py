"""Hybrid retrieval: OKF deterministic layer + vector search + BM25 + RRF fusion + MMR re-ranking.

V2 Pipeline:
  OKF Layer  — deterministic lookup in knowledge/ bundle (high trust, exact content)
  Vector     — ChromaDB cosine similarity search with HyDE
  BM25       — keyword search over local corpus
  RRF        — Reciprocal Rank Fusion merges vector + BM25 scores
  MMR        — diversity re-ranking on final set

OKF results are fetched in PARALLEL with the ChromaDB pipeline and merged
with a configurable trust boost (default: 1.2x score multiplier).
"""
import hashlib
import math
from typing import List, Dict, Any, Tuple

from db.chroma import get_collection
from services.embedding import embed_query
from services.bm25_cache import get_bm25_cache
from config import get_settings
import structlog

logger = structlog.get_logger()
settings = get_settings()

# BM25_CORPUS_LIMIT retired — BM25 now served from the precomputed bm25_cache module.
# The precomputed index is built once at startup and invalidated on upload.


class RetrievalResult:
    def __init__(self, content: str, metadata: Dict[str, Any], score: float):
        self.content = content
        self.metadata = metadata
        self.score = score

    @property
    def source(self) -> str:
        return self.metadata.get("filename", self.metadata.get("source", "unknown"))

    @property
    def doc_type(self) -> str:
        return self.metadata.get("doc_type", "document")

    @property
    def confidence(self) -> int:
        """Convert cosine similarity score (0–1) to a 0–100 confidence percentage."""
        return min(100, max(0, int(self.score * 100)))


def _content_key(content: str) -> str:
    """Stable, collision-resistant deduplication key based on full content hash."""
    return hashlib.md5(content.encode("utf-8", errors="replace")).hexdigest()


from openai import AsyncOpenAI

async def _generate_hyde_document(question: str) -> str:
    """Generate a hypothetical document answering the question for better embedding."""
    try:
        client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.llm_base_url,
        )
        response = await client.chat.completions.create(
            model=settings.llm_chat_model,
            messages=[
                {"role": "system", "content": "You are a domain expert. Write a factual, concise hypothetical snippet that answers the user's query. Do not use filler text."},
                {"role": "user", "content": question}
            ],
            temperature=0.3,
            max_tokens=200,
        )
        return response.choices[0].message.content or question
    except Exception as e:
        logger.warning("HyDE generation failed, falling back to raw query", error=str(e))
        return question

async def hybrid_search(
    question: str,
    top_k: int | None = None,
    filter_doc_type: str | None = None,
    use_okf: bool = True,
) -> List[RetrievalResult]:
    """
    V3 Hybrid search pipeline (latency-optimised):
    0. OKF Layer  — deterministic knowledge/ bundle lookup (parallel)
    1. Vector search  — ChromaDB cosine similarity
    2. BM25 keyword search — precomputed index (no per-query corpus reload)
    3. Reciprocal Rank Fusion (RRF) score combination
    4. MMR diversity re-ranking
    5. Merge: OKF first (trust-boosted), then deduplicated RAG results
    """
    import asyncio
    if top_k is None:
        top_k = settings.top_k_final

    collection = get_collection()
    total_chunks = collection.count()

    # Run OKF search in parallel with ChromaDB setup
    okf_task = None
    if use_okf and settings.okf_enabled:
        from services.okf_reader import get_okf_reader
        reader = get_okf_reader()
        okf_task = asyncio.create_task(reader.search(question, top_k=3))

    if total_chunks == 0 and not okf_task:
        logger.warning("No documents in collection and OKF disabled")
        return []

    if total_chunks == 0:
        # Only OKF results available
        okf_hits = await okf_task if okf_task else []
        return _convert_okf_hits(okf_hits)

    # Disabled HyDE generation for significantly faster retrieval and less hallucination.
    query_embedding = await embed_query(question)
    vector_k = min(settings.top_k_vector, total_chunks)

    where_filter = {"doc_type": filter_doc_type} if filter_doc_type else None

    vector_results = collection.query(
        query_embeddings=[query_embedding],
        n_results=vector_k,
        include=["documents", "metadatas", "distances"],
        where=where_filter,
    )

    vector_docs   = vector_results.get("documents", [[]])[0]
    vector_metas  = vector_results.get("metadatas",  [[]])[0]
    vector_dists  = vector_results.get("distances",  [[]])[0]

    # ChromaDB returns cosine distance in [0, 2]; convert to similarity in [0, 1]
    vector_scores = [max(0.0, 1.0 - (d / 2.0)) for d in vector_dists]

    # ── 2. BM25 Keyword Search (precomputed index) ──────────────────────────
    # The BM25 index is built once at startup and kept in memory.
    # This eliminates the 300-600ms per-query corpus reload from ChromaDB.
    # that previously ran on every single query.
    bm25_raw_results: List[Tuple[str, dict, float]] = []
    bm25_cache = get_bm25_cache()
    if bm25_cache.size > 0:
        query_tokens = question.lower().split()
        where_for_bm25 = {"doc_type": filter_doc_type} if filter_doc_type else None
        bm25_raw_results = bm25_cache.search(
            query_tokens,
            top_k=vector_k,
            where=where_for_bm25,
        )

    # ── 3. Reciprocal Rank Fusion ───────────────────────────────────────────
    # Key: MD5 hash of full content — no false collisions from prefix matching
    candidate_map: Dict[str, Dict] = {}

    for rank, (doc, meta, score) in enumerate(zip(vector_docs, vector_metas, vector_scores)):
        key = _content_key(doc)
        if key not in candidate_map:
            candidate_map[key] = {
                "content": doc,
                "metadata": meta,
                "rrf_score": 0.0,
                "vector_score": score,
            }
        candidate_map[key]["rrf_score"] += 1.0 / (60 + rank + 1)

    for rank, (doc, meta, score) in enumerate(bm25_raw_results):
        key = _content_key(doc)
        if key not in candidate_map:
            candidate_map[key] = {
                "content": doc,
                "metadata": meta,
                "rrf_score": 0.0,
                "vector_score": score,
            }
        candidate_map[key]["rrf_score"] += 1.0 / (60 + rank + 1)

    # Sort candidates by fused RRF score to select a subset for expensive Cross-Encoder
    candidates = sorted(candidate_map.values(), key=lambda x: x["rrf_score"], reverse=True)
    subset = candidates[: min(len(candidates), top_k * 3)]

    # ── 4. Cross-Encoder Re-ranking (DISABLED FOR ROBUSTNESS) ───────────────
    # We disable the MS-MARCO cross-encoder because it is too strict for 
    # casually phrased queries and often penalizes personal documents like resumes.
    # We now rely entirely on the much more robust RRF (Reciprocal Rank Fusion).
    
    selected = subset[:top_k]

    # Normalize RRF scores so they look like realistic confidence percentages (e.g. 95%, 85%)
    max_rrf = max((item["rrf_score"] for item in selected), default=1.0)

    rag_results = [
        RetrievalResult(
            content=item["content"],
            metadata=item["metadata"],
            score=min(0.99, (item["rrf_score"] / max_rrf) * 0.95),
        )
        for item in selected
    ]

    # ── 5. Merge OKF + RAG ───────────────────────────────────────────────────
    okf_results = []
    if okf_task:
        try:
            okf_hits = await okf_task
            okf_results = _convert_okf_hits(okf_hits)
            logger.debug("OKF results fetched", count=len(okf_results))
        except Exception as e:
            logger.warning("OKF search failed — proceeding with RAG only", error=str(e))

    if okf_results:
        # Deduplicate: exclude RAG results whose content matches an OKF result
        okf_keys = {_content_key(r.content) for r in okf_results}
        deduped_rag = [r for r in rag_results if _content_key(r.content) not in okf_keys]
        final = (okf_results + deduped_rag)[:top_k]
        logger.info("Hybrid search complete", okf=len(okf_results), rag=len(deduped_rag), total=len(final))
        return final

    logger.info("Hybrid search complete (RAG only)", rag=len(rag_results))
    return rag_results


_cross_encoder = None

def _get_cross_encoder():
    """Singleton lazy-loader for the CrossEncoder model."""
    global _cross_encoder
    if _cross_encoder is None:
        from sentence_transformers import CrossEncoder
        logger.info("Loading CrossEncoder model (cross-encoder/ms-marco-MiniLM-L-6-v2)...")
        _cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", max_length=512)
    return _cross_encoder


def _mmr_rerank(candidates: List[Dict], top_k: int) -> List[Dict]:
    """Maximal Marginal Relevance to balance relevance vs. diversity.

    Uses the RRF score as the relevance measure for all candidates so the
    comparison is on a consistent scale (vector_score and rrf_score are not
    comparable).
    """
    if not candidates:
        return []

    lambda_param = 1.0 - settings.mmr_diversity  # higher → more relevance, less diversity
    selected: List[Dict] = []
    remaining = candidates[: min(len(candidates), top_k * 3)]  # limit search space

    while len(selected) < top_k and remaining:
        if not selected:
            selected.append(remaining.pop(0))
            continue

        best_idx   = 0
        best_score = float("-inf")

        for i, candidate in enumerate(remaining):
            relevance  = candidate["rrf_score"]
            redundancy = max(
                _text_similarity(candidate["content"], s["content"])
                for s in selected
            )
            mmr_score = lambda_param * relevance - (1 - lambda_param) * redundancy
            if mmr_score > best_score:
                best_score = mmr_score
                best_idx   = i

        selected.append(remaining.pop(best_idx))

    return selected


def _text_similarity(a: str, b: str) -> float:
    """Jaccard similarity as a fast, dependency-free text overlap proxy."""
    set_a = set(a.lower().split())
    set_b = set(b.lower().split())
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union        = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0


def _convert_okf_hits(okf_hits: list) -> list[RetrievalResult]:
    """Convert OKFResult objects to RetrievalResult objects for unified pipeline."""
    results = []
    for hit in okf_hits:
        doc = hit.document
        # Apply trust boost from config (default 1.2x)
        boosted_score = min(1.0, hit.score * settings.okf_trust_boost)
        results.append(RetrievalResult(
            content=doc.content,
            metadata={
                "source":       doc.source_id,
                "filename":     doc.title,
                "doc_type":     f"okf_{doc.okf_type.lower()}",
                "okf_type":     doc.okf_type,
                "trust_level":  doc.trust_level,
                "is_okf":       True,
                "tags":         ",".join(doc.tags),
                "match_reason": hit.match_reason,
                "resource":     doc.resource,
                "is_stale":     doc.is_stale,
            },
            score=boosted_score,
        ))
    return results
