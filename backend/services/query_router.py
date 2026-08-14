"""services/query_router.py — Adaptive query router.

Classifies every incoming query into one of three routing tiers:
  FAST   — Simple, self-contained queries → skip LLM rewriter, use BM25 cache only
  NORMAL — Standard queries → full hybrid RAG (vector + BM25), skip rewriter
  COMPLEX — Long, multi-hop, or context-dependent → full pipeline with LLM rewriter

This avoids firing an 800–1200ms LLM call (the query rewriter) for ~70% of queries
that don't need it (short, unambiguous, no pronouns, no history references).

Research basis:
  "Adaptive RAG: Learning to Adapt Retrieval-Augmented Large Language Models"
  + 2025 production findings from Towards Data Science, GreenNode AI, etc.
"""
import re
from enum import Enum
from typing import Optional

import structlog

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Routing tiers
# ---------------------------------------------------------------------------

class QueryTier(str, Enum):
    FAST    = "fast"     # BM25 + single vector search, no rewriter
    NORMAL  = "normal"   # Full hybrid RAG, no rewriter
    COMPLEX = "complex"  # Full hybrid RAG + LLM rewriter


# ---------------------------------------------------------------------------
# Heuristic signals used for classification
# ---------------------------------------------------------------------------

# Pronouns / anaphoric references → query depends on prior context
_HISTORY_REFS = re.compile(
    r"\b(it|its|they|them|their|this|that|these|those|he|she|"
    r"the (above|previous|last|prior|aforementioned)|as mentioned|"
    r"you said|what about|and also|furthermore|additionally)\b",
    re.IGNORECASE,
)

# Question words that strongly suggest a complex / multi-hop intent
_COMPLEX_SIGNALS = re.compile(
    r"\b(compare|comparison|difference|vs\.?|versus|contrast|"
    r"relate|relationship|connect|between|across|multiple|"
    r"all|list all|summarize all|overview of all|"
    r"why|how did|what caused|root cause|impact of|"
    r"step.by.step|walk me through|explain in detail)\b",
    re.IGNORECASE,
)

# Question words that suggest simple single-fact lookups
_SIMPLE_SIGNALS = re.compile(
    r"^(what is|what are|who is|where is|when did|how to|"
    r"what does|define|show me|give me|tell me|list|find)\b",
    re.IGNORECASE,
)


def classify_query(
    question: str,
    has_session_history: bool = False,
    max_simple_chars: int = 120,
) -> QueryTier:
    """Classify a query into a routing tier.

    Args:
        question:            The raw user question.
        has_session_history: Whether there is prior conversation history for this session.
        max_simple_chars:    Configurable upper bound for "simple" query length.

    Returns:
        QueryTier enum value.
    """
    q = question.strip()

    # Any history-referencing pronouns → must rewrite with context
    if has_session_history and _HISTORY_REFS.search(q):
        logger.debug("Router -> COMPLEX (history reference)", query=q[:60])
        return QueryTier.COMPLEX

    # Very long queries → likely complex
    if len(q) > 300:
        logger.debug("Router -> COMPLEX (long query)", length=len(q))
        return QueryTier.COMPLEX

    # Explicit complex-intent keywords
    if _COMPLEX_SIGNALS.search(q):
        logger.debug("Router -> COMPLEX (complex signal)", query=q[:60])
        return QueryTier.COMPLEX

    # Short + starts with simple question word → FAST path
    if len(q) <= max_simple_chars and _SIMPLE_SIGNALS.match(q):
        logger.debug("Router -> FAST (simple query)", query=q[:60])
        return QueryTier.FAST

    # Default: NORMAL (full RAG, but skip the LLM rewriter)
    logger.debug("Router -> NORMAL", query=q[:60])
    return QueryTier.NORMAL
