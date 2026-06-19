"""GPT-4o streaming LLM service with knowledge card extraction."""
import json
import re
from typing import AsyncIterator, List
from openai import AsyncOpenAI
from services.retrieval import RetrievalResult
from config import get_settings
import structlog

logger = structlog.get_logger()
settings = get_settings()

SYSTEM_PROMPT = """You are an Engineering Intelligence Assistant for a software engineering team.
You answer questions based ONLY on the provided knowledge base context.
You are precise, technical, and helpful.

Rules:
1. Answer based ONLY on the provided context. If the context doesn't contain the answer, say so clearly.
2. Always cite your sources using the [SOURCE: filename] format inline.
3. Structure your response with clear headings when answering complex questions.
4. For technical topics, include code examples when relevant from the context.
5. Be concise but complete. Prefer bullet points for lists of items.
6. At the end of your answer, output a JSON block in this exact format:
   ```knowledge_cards
   [
     {"title": "Card Title", "content": "Brief description", "type": "service|flow|concept|alert"},
     ...
   ]
   ```
   Include 2-4 relevant knowledge cards that highlight key concepts from your answer.
   Only output the knowledge_cards block — no other JSON.
"""


def _build_context(results: List[RetrievalResult]) -> str:
    """Format retrieved chunks into a context string."""
    if not results:
        return "No relevant documentation found in the knowledge base."

    context_parts = []
    for i, result in enumerate(results, 1):
        context_parts.append(
            f"[DOCUMENT {i}] Source: {result.source}\n"
            f"Confidence: {result.confidence}%\n"
            f"---\n{result.content}"
        )
    return "\n\n".join(context_parts)


async def stream_answer(
    question: str,
    results: List[RetrievalResult],
    session_id: str | None = None,
) -> AsyncIterator[str]:
    """Stream GPT-4o response with context from retrieved documents."""
    from services.memory import get_history, add_message
    
    client = AsyncOpenAI(api_key=settings.openai_api_key, base_url="https://api.groq.com/openai/v1")
    context = _build_context(results)

    user_message = f"""Question: {question}

Knowledge Base Context:
{context}

Answer the question based on the context above. Include inline citations like [SOURCE: filename].
"""

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    if session_id:
        history = get_history(session_id)
        messages.extend(history)
        add_message(session_id, "user", question)

    messages.append({"role": "user", "content": user_message})

    try:
        stream = await client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=messages,
            stream=True,
            temperature=0.1,
            max_tokens=2000,
        )

        full_response = ""
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                full_response += delta.content
                yield delta.content
                
        if session_id:
            add_message(session_id, "assistant", full_response)

    except Exception as e:
        logger.error("LLM streaming failed", error=str(e))
        yield f"\n\nError generating response: {str(e)}"


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


def parse_knowledge_cards(answer: str) -> list[dict]:
    """Extract knowledge cards JSON from the answer text."""
    pattern = r"```knowledge_cards\s*([\s\S]*?)```"
    match = re.search(pattern, answer)
    if not match:
        return []
    try:
        cards = json.loads(match.group(1).strip())
        if isinstance(cards, list):
            return cards[:4]
    except json.JSONDecodeError:
        pass
    return []


def strip_knowledge_cards(answer: str) -> str:
    """Remove the knowledge_cards JSON block from the answer text."""
    pattern = r"\n?```knowledge_cards\s*[\s\S]*?```\n?"
    return re.sub(pattern, "", answer).strip()
