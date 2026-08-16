import os
import chromadb
from chromadb.config import Settings as ChromaSettings
from functools import lru_cache
from config import get_settings
import structlog

logger = structlog.get_logger()

# Resolve persist directory relative to this file's location (backend/db/ -> vectorstore/)
_DEFAULT_PERSIST_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "vectorstore")
)


@lru_cache()
def get_chroma_client() -> chromadb.PersistentClient:
    app_settings = get_settings()
    persist_dir = app_settings.chroma_persist_dir
    # Resolve relative paths to absolute so ChromaDB always persists in the right place
    if not os.path.isabs(persist_dir):
        persist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", persist_dir))
    os.makedirs(persist_dir, exist_ok=True)
    logger.info("Using local ChromaDB (PersistentClient)", path=persist_dir)
    client = chromadb.PersistentClient(
        path=persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    return client


def get_collection():
    app_settings = get_settings()
    client = get_chroma_client()
    # We always supply pre-computed embeddings to .add() and .query(),
    # so no ChromaDB-side embedding function is needed.
    # Passing embedding_function=None silences the "already exists" conflict
    # when the collection was previously created with a different function.
    try:
        collection = client.get_or_create_collection(
            name=app_settings.chroma_collection,
            metadata={"hnsw:space": "cosine"},
            embedding_function=None,
        )
    except Exception:
        # Older ChromaDB versions don't accept embedding_function=None in
        # get_or_create_collection; fall back to get_collection() only.
        collection = client.get_collection(
            name=app_settings.chroma_collection,
            embedding_function=None,
        )
    return collection


def get_all_documents_metadata() -> list[dict]:
    """Return unique source metadata for all stored documents."""
    collection = get_collection()
    results = collection.get(include=["metadatas"])
    metadatas = results.get("metadatas") or []
    seen = {}
    for meta in metadatas:
        source = meta.get("source", "unknown")
        if source not in seen:
            seen[source] = {
                "source": source,
                "doc_type": meta.get("doc_type", "document"),
                "filename": meta.get("filename", source),
                "indexed_at": meta.get("indexed_at", ""),
            }
    return list(seen.values())


def get_total_chunks() -> int:
    collection = get_collection()
    return collection.count()
