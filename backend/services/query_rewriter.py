import structlog
from config import get_settings
from openai import AsyncOpenAI

logger = structlog.get_logger()
settings = get_settings()

SYSTEM_PROMPT = """You are an expert AI query analyzer.
Your job is to read a user's latest question and the chat history preceding it.
If the user's latest question is a follow-up that relies on context from the chat history (e.g., uses pronouns like "it", "they", or implicitly refers to a previously discussed topic), rewrite the question into a standalone query that contains all necessary context for a search engine.
If the latest question is already a standalone query, return it exactly as is.

IMPORTANT: 
- Return ONLY the rewritten question. 
- Do NOT include any conversational filler (e.g., "Here is the rewritten query:").
- Do NOT answer the question.
"""

async def rewrite_query(question: str, history: list[dict]) -> str:
    """
    Rewrites the user's query into a standalone query using the conversation history.
    """
    if not history:
        return question

    try:
        client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.llm_base_url,
            timeout=10.0,
        )

        # Only use the last 4 messages to prevent prompt bloat and focus on immediate context
        history_text = "\n".join([f"{msg['role'].capitalize()}: {msg['content'][:500]}" for msg in history[-4:]])
        
        prompt = f"Chat History:\n{history_text}\n\nLatest User Question: {question}\n\nRewritten Standalone Question:"

        response = await client.chat.completions.create(
            model=settings.llm_chat_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            max_tokens=100,
        )

        rewritten = response.choices[0].message.content.strip()
        
        # Fallback if the model misbehaves
        if not rewritten or len(rewritten) > len(question) + 200:
            return question

        if rewritten.lower() != question.lower():
            logger.info("Query rewritten for context", original=question, rewritten=rewritten)

        return rewritten

    except Exception as e:
        logger.warning("Query rewriting failed, falling back to original query", error=str(e))
        return question
