"""Engineering Intelligence Hub — FastAPI Application Entry Point."""
import logging
import os
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from config import get_settings
from routers import upload, github, chat, sources, stats

# Configure structured logging
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.getenv("LOG_LEVEL", "INFO"))
    ),
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    settings = get_settings()

    # Ensure upload directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs("./vectorstore", exist_ok=True)

    logger.info(
        "Engineering Intelligence Hub starting",
        model=settings.openai_chat_model,
        embedding_model=settings.openai_embedding_model,
        chroma_host=settings.chroma_host,
    )

    # Test ChromaDB connection
    try:
        from db.chroma import get_chroma_client, get_collection
        client = get_chroma_client()
        client.heartbeat()
        collection = get_collection()
        count = collection.count()
        logger.info("ChromaDB connected", chunks=count)
    except Exception as e:
        logger.error("ChromaDB connection failed — will retry on first request", error=str(e))

    yield

    logger.info("Engineering Intelligence Hub shutting down")


app = FastAPI(
    title="Engineering Intelligence Hub",
    description="RAG-powered AI assistant for engineering teams",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routers
app.include_router(upload.router, tags=["Ingestion"])
app.include_router(github.router, tags=["Ingestion"])
app.include_router(chat.router, tags=["Chat"])
app.include_router(sources.router, tags=["Knowledge Base"])
app.include_router(stats.router, tags=["Admin"])


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    try:
        from db.chroma import get_chroma_client
        client = get_chroma_client()
        client.heartbeat()
        chroma_status = "ok"
    except Exception as e:
        chroma_status = f"error: {str(e)[:50]}"

    return {
        "status": "ok",
        "service": "Engineering Intelligence Hub",
        "chromadb": chroma_status,
    }
