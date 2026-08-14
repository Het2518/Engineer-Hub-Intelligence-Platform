"""AI-Research Assistant v2 — FastAPI Application Entry Point.

V2 Features:
  - OKF (Open Knowledge Format) hybrid knowledge layer
  - Multi-RAG pipeline with CRAG quality gate
  - Knowledge Studio API (/knowledge)
  - Removed Docker dependency (local-first architecture)
"""
import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()  # Load .env into os.environ for LangSmith/LangChain

import structlog
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from config import get_settings
from core.limiter import limiter
from core.security import verify_api_key
from routers import upload, github, chat, sources, stats
from routers import knowledge as knowledge_router

# Configure structured logging
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
logger = structlog.get_logger()

settings = get_settings()


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""

    # Ensure required directories exist
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.chroma_persist_dir, exist_ok=True)
    os.makedirs(settings.okf_knowledge_dir, exist_ok=True)

    print(f"""
+------------------------------------------------------+
|         AI Research Assistant  v2.0                  |
|------------------------------------------------------|
|  Model        : {settings.llm_chat_model:<36}|
|  Embedding    : Local (all-MiniLM-L6-v2)            |
|  OKF Layer    : {'enabled' if settings.okf_enabled else 'disabled':<36}|
|  Multi-Query  : {'enabled' if settings.multi_query_enabled else 'disabled':<36}|
|  CRAG         : {'enabled' if settings.crag_enabled else 'disabled':<36}|
+------------------------------------------------------+
    """)

    # Test ChromaDB connection
    try:
        from db.chroma import get_chroma_client, get_collection
        client = get_chroma_client()
        client.heartbeat()
        collection = get_collection()
        count = collection.count()
        logger.info("ChromaDB connected", chunks=count, path=settings.chroma_persist_dir)
    except Exception as e:
        logger.error("ChromaDB connection failed — will retry on first request", error=str(e))

    # Warm up BM25 precomputed index
    try:
        from services.bm25_cache import get_bm25_cache
        bm25 = get_bm25_cache()
        await bm25.rebuild()
        logger.info("BM25 index warmed up", corpus_size=bm25.size)
    except Exception as e:
        logger.warning("BM25 warm-up failed — will build on first query", error=str(e))

    # Pre-load OKF knowledge bundle
    if settings.okf_enabled:
        try:
            from services.okf_reader import get_okf_reader
            reader = get_okf_reader()
            docs = await reader.all_documents()
            logger.info("OKF knowledge bundle ready", documents=len(docs))
        except Exception as e:
            logger.warning("OKF bundle load failed — OKF will retry on first request", error=str(e))

    yield

    logger.info("AI-Research Assistant v2 shutting down")


from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler


# ── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI Research Assistant",
    description="V2: Hybrid OKF + Multi-RAG powered AI assistant for engineering teams",
    version="2.0.0",
    lifespan=lifespan,
    dependencies=[Depends(verify_api_key)],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# Compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(upload.router,             tags=["Ingestion"])
app.include_router(github.router,             tags=["Ingestion"])
app.include_router(chat.router,               tags=["Chat"])
app.include_router(sources.router,            tags=["Knowledge Base"])
app.include_router(stats.router,              tags=["Admin"])
app.include_router(knowledge_router.router,   tags=["Knowledge"])   # ← V2: OKF


# ── Cache & Analytics Endpoints ─────────────────────────────────────────────

@app.get("/cache/stats", tags=["Admin"])
async def cache_stats():
    """Return semantic cache statistics (hit rate, size, TTL)."""
    from services.semantic_cache import get_semantic_cache
    return get_semantic_cache().stats


@app.post("/cache/clear", tags=["Admin"])
async def cache_clear():
    """Force-clear the semantic cache (e.g. after bulk document uploads)."""
    from services.semantic_cache import get_semantic_cache
    count = await get_semantic_cache().clear()
    return {"status": "cleared", "entries_removed": count}


@app.get("/analytics/pipeline", tags=["Admin"])
async def pipeline_analytics():
    """Return pipeline health info: BM25 index size, cache stats, ChromaDB chunks."""
    from services.bm25_cache import get_bm25_cache
    from services.semantic_cache import get_semantic_cache

    bm25 = get_bm25_cache()
    cache = get_semantic_cache()

    chroma_count = 0
    try:
        from db.chroma import get_collection
        chroma_count = get_collection().count()
    except Exception:
        pass

    return {
        "bm25_index": {
            "corpus_size": bm25.size,
            "built_at": bm25.built_at,
            "ready": bm25.size > 0,
        },
        "semantic_cache": cache.stats,
        "chromadb": {"chunks": chroma_count},
        "model": settings.llm_chat_model,
        "smart_router": settings.smart_router_enabled,
        "contextual_chunking": settings.contextual_chunking_enabled,
    }

# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check — returns status of all subsystems."""
    status: dict = {
        "status": "ok",
        "version": "2.0.0",
        "service": "AI Research Assistant",
        "llm_configured": bool(settings.groq_api_key),
        "llm_model": settings.llm_chat_model,
    }

    # ChromaDB
    try:
        from db.chroma import get_chroma_client, get_collection
        get_chroma_client().heartbeat()
        status["chromadb"] = {"status": "ok", "chunks": get_collection().count()}
    except Exception as e:
        status["chromadb"] = {"status": "error", "detail": str(e)[:80]}

    # OKF
    if settings.okf_enabled:
        try:
            from services.okf_reader import get_okf_reader
            docs = await get_okf_reader().all_documents()
            status["okf"] = {"status": "ok", "documents": len(docs)}
        except Exception as e:
            status["okf"] = {"status": "error", "detail": str(e)[:80]}
    else:
        status["okf"] = {"status": "disabled"}

    return status
