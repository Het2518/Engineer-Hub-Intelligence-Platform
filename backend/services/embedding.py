"""Local embedding service using ChromaDB default model."""
import asyncio
from typing import List
import chromadb.utils.embedding_functions as embedding_functions
import structlog
from config import get_settings

logger = structlog.get_logger()
settings = get_settings()

_ef = None

def get_embedding_function():
    global _ef
    if _ef is None:
        _ef = embedding_functions.DefaultEmbeddingFunction()
    return _ef

async def embed_texts(texts: List[str], batch_size: int = 100) -> List[List[float]]:
    """Generate embeddings for a list of texts using local model."""
    if not texts:
        return []

    ef = get_embedding_function()
    all_embeddings: List[List[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        batch = [t.replace("\n", " ").strip() for t in batch if t.strip()]

        try:
            # Run synchronously since we are wrapping an un-async local model. 
            # In production, we'd use run_in_executor
            batch_embeddings = ef(batch)
            all_embeddings.extend(batch_embeddings)
            logger.info("Embedded batch", batch_num=i // batch_size + 1, count=len(batch))
        except Exception as e:
            logger.error("Embedding failed", error=str(e), batch_start=i)
            raise

    return all_embeddings

async def embed_query(text: str) -> List[float]:
    """Embed a single query string."""
    embeddings = await embed_texts([text])
    if embeddings:
        return embeddings[0]
    raise ValueError("Failed to generate query embedding")
