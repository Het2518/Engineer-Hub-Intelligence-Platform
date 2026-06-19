"""Hybrid retrieval: vector search + BM25 keyword search with MMR re-ranking."""
import math
from typing import List, Dict, Any, Tuple
from rank_bm25 import BM25Okapi
from db.chroma import get_collection
from services.embedding import embed_query
from config import get_settings
import structlog

logger = structlog.get_logger()
settings = get_settings()


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
        """Convert cosine similarity score to a 0-100 confidence percentage."""
        # Cosine similarity in [0, 1] after normalization
        return min(100, max(0, int(self.score * 100)))


async def hybrid_search(
    question: str,
    top_k: int | None = None,
    filter_doc_type: str | None = None,
) -> List[RetrievalResult]:
    """
    Perform hybrid search combining:
    1. Vector search (ChromaDB cosine similarity)
    2. BM25 keyword search
    3. Score fusion (Reciprocal Rank Fusion)
    4. MMR re-ranking for diversity
    """
    if top_k is None:
        top_k = settings.top_k_final

    collection = get_collection()
    total_chunks = collection.count()

    if total_chunks == 0:
        logger.warning("No documents in collection")
        return []

    # ── 1. Vector Search ────────────────────────────────────────────────────
    query_embedding = await embed_query(question)
    vector_k = min(settings.top_k_vector, total_chunks)

    where_filter = {"doc_type": filter_doc_type} if filter_doc_type else None

    vector_results = collection.query(
        query_embeddings=[query_embedding],
        n_results=vector_k,
        include=["documents", "metadatas", "distances"],
        where=where_filter,
    )

    vector_docs = vector_results.get("documents", [[]])[0]
    vector_metas = vector_results.get("metadatas", [[]])[0]
    vector_distances = vector_results.get("distances", [[]])[0]

    # Convert cosine distance [0, 2] → similarity [0, 1]
    vector_scores = [max(0.0, 1.0 - (d / 2.0)) for d in vector_distances]

    # ── 2. BM25 Keyword Search ──────────────────────────────────────────────
    # Fetch all docs for BM25 corpus (limited to 500 for performance)
    all_data = collection.get(
        include=["documents", "metadatas"],
        limit=500,
        where=where_filter,
    )
    all_docs = all_data.get("documents") or []
    all_metas = all_data.get("metadatas") or []
    all_ids = all_data.get("ids") or []

    bm25_results: List[Tuple[int, float]] = []
    if all_docs:
        tokenized = [doc.lower().split() for doc in all_docs]
        bm25 = BM25Okapi(tokenized)
        query_tokens = question.lower().split()
        scores = bm25.get_scores(query_tokens)
        # Get top-k indices by BM25 score
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:vector_k]
        max_score = max(scores) if scores.any() else 1.0
        bm25_results = [(i, scores[i] / max_score if max_score > 0 else 0.0) for i in top_indices]

    # ── 3. Reciprocal Rank Fusion ───────────────────────────────────────────
    candidate_map: Dict[str, Dict] = {}

    # Add vector results
    for rank, (doc, meta, score) in enumerate(zip(vector_docs, vector_metas, vector_scores)):
        key = doc[:100]  # Use content prefix as key
        if key not in candidate_map:
            candidate_map[key] = {"content": doc, "metadata": meta, "rrf_score": 0.0, "vector_score": score}
        candidate_map[key]["rrf_score"] += 1.0 / (60 + rank + 1)

    # Add BM25 results
    for rank, (idx, score) in enumerate(bm25_results):
        if idx < len(all_docs):
            doc = all_docs[idx]
            meta = all_metas[idx]
            key = doc[:100]
            if key not in candidate_map:
                candidate_map[key] = {"content": doc, "metadata": meta, "rrf_score": 0.0, "vector_score": score}
            candidate_map[key]["rrf_score"] += 1.0 / (60 + rank + 1)

    # Sort by RRF score
    candidates = sorted(candidate_map.values(), key=lambda x: x["rrf_score"], reverse=True)

    # ── 4. MMR Diversity Re-ranking ─────────────────────────────────────────
    selected = _mmr_rerank(candidates, query_embedding, top_k)

    return [
        RetrievalResult(
            content=item["content"],
            metadata=item["metadata"],
            score=item.get("vector_score", item["rrf_score"]),
        )
        for item in selected
    ]


def _mmr_rerank(
    candidates: List[Dict],
    query_embedding: List[float],
    top_k: int,
) -> List[Dict]:
    """Maximal Marginal Relevance to balance relevance vs. diversity."""
    if not candidates:
        return []

    lambda_param = 1.0 - settings.mmr_diversity  # relevance weight
    selected = []
    remaining = candidates[:min(len(candidates), top_k * 3)]  # limit search space

    while len(selected) < top_k and remaining:
        if not selected:
            # First pick: highest relevance
            selected.append(remaining.pop(0))
            continue

        best_idx = 0
        best_score = float("-inf")

        for i, candidate in enumerate(remaining):
            relevance = candidate.get("vector_score", candidate["rrf_score"])
            # Redundancy = max similarity with already-selected docs (text overlap proxy)
            redundancy = max(
                _text_similarity(candidate["content"], s["content"])
                for s in selected
            )
            mmr_score = lambda_param * relevance - (1 - lambda_param) * redundancy
            if mmr_score > best_score:
                best_score = mmr_score
                best_idx = i

        selected.append(remaining.pop(best_idx))

    return selected


def _text_similarity(a: str, b: str) -> float:
    """Jaccard similarity as a fast proxy for text overlap."""
    set_a = set(a.lower().split())
    set_b = set(b.lower().split())
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0
