"""LLM service - Provider-agnostic RAG answer generation with production-grade
retrieval/context handling and a generalized, format-flexible system prompt.

This module is designed to be a reusable foundation for any RAG-based system
(documentation assistants, enterprise knowledge bases, AI search, customer
support, coding assistants, research assistants, internal copilots, etc.)
and works with any modern instruction-following LLM (GPT, Claude, Gemini,
Llama, Qwen, DeepSeek, Mistral, and others) exposed through an
OpenAI-compatible chat completions API.
"""

import re
import asyncio
import difflib
from typing import AsyncIterator, List
from openai import AsyncOpenAI
from services.retrieval import RetrievalResult
from config import get_settings
import structlog

logger = structlog.get_logger()
settings = get_settings()

MAX_HISTORY_MESSAGES = 20

# ---------------------------------------------------------------------------
# Context construction tuning
# ---------------------------------------------------------------------------
MAX_CONTEXT_DOCUMENTS = 5          # cap number of chunks sent to the model
MAX_CHARS_PER_DOCUMENT = 1200      # per-chunk truncation for token efficiency
MAX_TOTAL_CONTEXT_CHARS = 5500     # overall context budget (approx. token guard)
MIN_CONFIDENCE_THRESHOLD = 30      # absolute floor: drop chunks below this score (%)
RELATIVE_CONFIDENCE_RATIO = 0.72   # relative floor: drop chunks below top_score * ratio
NEAR_DUPLICATE_SIMILARITY = 0.88   # SequenceMatcher ratio above which chunks are treated as duplicates

# ---------------------------------------------------------------------------
# System Prompt - General-purpose, format-agnostic RAG assistant
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are a precise, expert AI Assistant powered by Retrieval-Augmented Generation (RAG).
Your single most important job is to answer questions STRICTLY and ONLY from the retrieved context
provided to you. You must NEVER mix information from unrelated documents into your answer.

## CRITICAL ANTI-HALLUCINATION RULES — Always enforced, no exceptions

1. **Use only what is directly relevant to the question.**
   Each retrieved document has a RANK and RELEVANCE score. Focus your answer on the highest-ranked,
   most relevant documents. If a retrieved chunk is from a different topic or system than what the
   user asked about, SILENTLY IGNORE IT. Do not reference it, summarize it, or blend it in.

2. **Never mix unrelated topics.**
   If the user asks about Product A, do not include information about Product B, System C, or any
   unrelated process — even if those documents were retrieved. Each answer must stay on topic.

3. **Never invent facts.**
   Do not fabricate product names, features, APIs, numbers, file names, people, or any other
   specific claim. Every factual statement must be traceable to a specific retrieved chunk.

4. **Insufficient context → say so honestly.**
   If the retrieved context does not contain enough information to fully answer the question,
   say clearly: "The available documentation does not cover this in detail." Do not pad the
   answer with tangential information to make it seem complete.

5. **Never cite a source that isn't in the context.**
   Only reference filenames and sources that actually appear in the provided document blocks.

## Grounding Rules
- Every factual claim must come from the retrieved context. Label general-knowledge statements
  explicitly if you must include them: "(general knowledge, not from the documents)".
- If two retrieved documents conflict, surface the conflict clearly. Do not silently pick one.
- The relevance % shown in each document block is your signal: high relevance = use this,
  low relevance for this question = skip it.

## Response Formatting
Choose the format that best serves the request:
- **Markdown** for explanatory answers (headings, bold, lists)
- **Code blocks** with language tags for code or config
- **Tables** for structured comparisons
- **Mermaid diagrams** for architecture or flow explanations (when helpful)
- **Plain text** for short, simple answers
Match depth to complexity. A simple factual question gets a short direct answer.
A multi-part technical question gets structured headings and examples.

## Citations
- Cite inline as [Source: filename] immediately after each claim, using only filenames from the
  provided context blocks.
- Do not cite general knowledge or reasoning.

## Tone
- Direct, confident, professional.
- Do not say "based on the provided context" or "as an AI".
- Do not pad with filler phrases or unnecessary caveats.

"""


def _normalize_for_dedup(text: str) -> str:
    """Normalize text for near-duplicate comparison (whitespace/case-insensitive)."""
    return re.sub(r"\s+", " ", text).strip().lower()


def _is_near_duplicate(candidate: str, seen: List[str]) -> bool:
    """Check whether `candidate` is a near-duplicate of any string already in `seen`."""
    for existing in seen:
        ratio = difflib.SequenceMatcher(None, candidate, existing).ratio()
        if ratio >= NEAR_DUPLICATE_SIMILARITY:
            return True
    return False


def _select_and_rank_results(results: List[RetrievalResult]) -> List[RetrievalResult]:
    """Filter, deduplicate, and rank retrieved chunks before they reach the LLM.

    Pipeline:
    1. Absolute floor: drop chunks below MIN_CONFIDENCE_THRESHOLD.
    2. Sort by confidence descending.
    3. Relative floor: drop chunks below (top_score * RELATIVE_CONFIDENCE_RATIO).
       This prevents low-relevance tangential documents from polluting the context
       when a clearly dominant, highly-relevant document exists (e.g. 95% match vs
       62% match from a completely different topic).
    4. Near-duplicate removal.
    5. Cap to top-N.
    """
    if not results:
        return []

    # Step 1: absolute confidence floor
    filtered = [r for r in results if getattr(r, "confidence", 0) >= MIN_CONFIDENCE_THRESHOLD]
    if not filtered:
        filtered = list(results)  # fallback: use everything if threshold filters all

    # Step 2: sort best-first
    filtered.sort(key=lambda r: getattr(r, "confidence", 0), reverse=True)

    # Step 3: relative confidence floor — prevents tangential low-score docs poisoning context
    if filtered:
        top_score = getattr(filtered[0], "confidence", 0)
        relative_floor = top_score * RELATIVE_CONFIDENCE_RATIO
        filtered = [r for r in filtered if getattr(r, "confidence", 0) >= relative_floor]

    # Step 4 & 5: dedup + cap
    selected: List[RetrievalResult] = []
    seen_normalized: List[str] = []

    for result in filtered:
        normalized = _normalize_for_dedup(result.content)
        if not normalized:
            continue
        if _is_near_duplicate(normalized, seen_normalized):
            continue
        selected.append(result)
        seen_normalized.append(normalized)
        if len(selected) >= MAX_CONTEXT_DOCUMENTS:
            break

    return selected


def _build_context(results: List[RetrievalResult]) -> str:
    """Format retrieved chunks into a ranked, deduplicated, token-efficient context block."""
    if not results:
        return "No relevant documentation found in the knowledge base."

    ranked = _select_and_rank_results(results)
    if not ranked:
        return "No sufficiently relevant documentation found in the knowledge base."

    context_parts = []
    running_chars = 0

    for i, result in enumerate(ranked, 1):
        snippet = result.content.strip()
        if len(snippet) > MAX_CHARS_PER_DOCUMENT:
            snippet = snippet[:MAX_CHARS_PER_DOCUMENT].rstrip() + " [...truncated]"

        block = (
            f"[DOCUMENT {i} | RANK {i} OF {len(ranked)}]\n"
            f"Source: {result.source} | Type: {result.doc_type} | Relevance: {result.confidence}%\n"
            f"{'-' * 60}\n"
            f"{snippet}"
        )

        # Respect an overall context budget so large enterprise knowledge bases
        # don't blow the token window; higher-ranked (more relevant) documents
        # are always included first since the list is pre-sorted.
        if running_chars + len(block) > MAX_TOTAL_CONTEXT_CHARS and context_parts:
            break

        context_parts.append(block)
        running_chars += len(block)

    return "\n\n".join(context_parts)


def _build_fallback_answer(question: str, results: List[RetrievalResult]) -> str:
    """Return a clean, single-source fallback when the model provider is unavailable."""
    ranked = _select_and_rank_results(results)

    if not ranked:
        return (
            "The AI model is temporarily unavailable, and no relevant content was found "
            "in the knowledge base for this query.\n\n"
            "Please check your model provider configuration and try again."
        )

    # Show only the single best hit — clean and readable
    best = ranked[0]
    snippet = re.sub(r"\s+", " ", best.content.strip())
    if len(snippet) > 600:
        snippet = snippet[:597].rstrip() + "…"

    return (
        f"> **Model temporarily unavailable.** Showing the most relevant knowledge base result.\n\n"
        f"---\n\n"
        f"{snippet}\n\n"
        f"---\n\n"
        f"*Source: {best.source} · {best.confidence}% relevance*\n\n"
        f"*To get a full synthesised answer, verify your API key configuration and try again.*"
    )


from langsmith import traceable

@traceable
async def stream_answer(
    question: str,
    results: List[RetrievalResult],
    session_id: str | None = None,
    attached_files: List[dict] | None = None,
) -> AsyncIterator[str]:
    """Stream a rich, structured LLM response grounded in ranked, deduplicated context."""
    from services.memory import get_history, add_message

    client = AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url=settings.llm_base_url,
        timeout=60.0,
    )
    context = _build_context(results)
    
    file_injection = ""
    if attached_files:
        files_text = "\n\n".join([f"=== File: {f.get('filename')} ===\n{f.get('content')}" for f in attached_files])
        file_injection = f"**User Attached Documents (Highest Priority Context):**\n{files_text}\n\n=========================\n\n"

    user_message = (
        f"{file_injection}"
        f"**Question:** {question}\n\n"
        f"**Retrieved Knowledge Base Context (ranked by relevance):**\n\n{context}\n\n"
        f"Answer using the format that best fits this request (Markdown, code, table, JSON, "
        f"diagram, or a mix — your judgment). Ground every factual claim in the context above, "
        f"cite sources inline, and clearly flag anything the context doesn't cover."
    )

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if session_id:
        history = await get_history(session_id)
        if len(history) > MAX_HISTORY_MESSAGES:
            history = history[-MAX_HISTORY_MESSAGES:]
        messages.extend(history)
        await add_message(session_id, "user", question)

    messages.append({"role": "user", "content": user_message})


    last_error = None
    for attempt in range(2):
        try:
            stream = await client.chat.completions.create(
                model=settings.llm_chat_model,
                messages=messages,
                stream=True,
                temperature=0.3,
                max_tokens=3000,
                top_p=0.9,
            )

            full_response = ""
            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    full_response += delta.content
                    yield delta.content

            if session_id:
                await add_message(session_id, "assistant", full_response)

            return

        except Exception as e:
            last_error = e
            logger.warning(
                "LLM streaming attempt failed",
                attempt=attempt + 1,
                error=str(e),
                question=question,
            )
            if attempt == 0:
                await asyncio.sleep(1.5)

    logger.error(
        "LLM streaming failed after retries",
        error=str(last_error),
        question=question,
        session_id=session_id,
    )
    yield _build_fallback_answer(question, results)


async def get_answer(
    question: str,
    results: List[RetrievalResult],
    session_id: str | None = None,
) -> str:
    """Non-streaming answer for internal use."""
    full_response = ""
    async for chunk in stream_answer(question, results, session_id):
        full_response += chunk
    return full_response