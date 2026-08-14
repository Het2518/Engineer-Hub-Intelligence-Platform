"""POST /upload — Ingest documents into the knowledge base.

Security / correctness fixes (2026-07-29 audit):
- File is streamed to disk in 64 KB chunks; size is rejected BEFORE the full
  content is read into memory, preventing OOM with large malicious files.
- Original filename is sanitised (path-traversal characters stripped) before
  being stored in metadata.
- SHA-256 content hash detects duplicate uploads and returns early without
  creating redundant vector chunks.
"""
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List
import asyncio

from fastapi import APIRouter, File, UploadFile, HTTPException

from config import get_settings
from db.chroma import get_collection
from db.stats_store import increment_documents, increment_chunks
from schemas.upload import UploadResponse, ParseResponse
from services.ingestion import extract_text
from services.chunking import chunk_text
from services.embedding import embed_texts
import structlog

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter()

ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".doc", ".txt", ".md", ".markdown",
    ".json", ".csv", ".png", ".jpg", ".jpeg",
}
CHUNK_SIZE   = 64 * 1024          # 64 KB streaming chunks
MAX_BYTES    = settings.max_file_size_mb * 1024 * 1024
MAX_TEXT_LEN = 500_000            # chars — prevents token budget explosion


def _sanitize_filename(raw: str) -> str:
    """Strip path separators and null bytes; keep the basename only."""
    name = Path(raw).name                       # strip any directory component
    safe = "".join(c for c in name if c not in r'\/:*?"<>|' and c != "\x00")
    return safe or "unnamed_file"


def _detect_doc_type(filename: str) -> str:
    name   = filename.lower()
    suffix = Path(filename).suffix.lower()
    if any(kw in name for kw in ["incident", "postmortem", "outage", "alert"]):
        return "incident_report"
    if any(kw in name for kw in ["runbook", "playbook", "procedure"]):
        return "runbook"
    if any(kw in name for kw in ["readme", "setup", "install", "onboard"]):
        return "readme"
    if any(kw in name for kw in ["arch", "architecture", "diagram", "design"]):
        return "architecture"
    if suffix in {".png", ".jpg", ".jpeg"}:
        return "architecture_diagram"
    if suffix in {".md", ".markdown"}:
        return "documentation"
    return "document"


def _check_duplicate(content_hash: str) -> bool:
    """Return True if a document with this hash is already indexed."""
    collection = get_collection()
    results = collection.get(
        where={"content_hash": content_hash},
        include=["metadatas"],
        limit=1,
    )
    return bool(results.get("metadatas"))


from core.limiter import limiter
from fastapi import Request

@router.post("/upload", response_model=UploadResponse)
@limiter.limit("5/minute")
async def upload_document(request: Request, file: UploadFile = File(...)) -> UploadResponse:
    """Upload and index a document into the knowledge base."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    safe_name = _sanitize_filename(file.filename)
    suffix    = Path(safe_name).suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    file_path   = upload_dir / stored_name

    try:
        # ── Stream to disk with size guard ──────────────────────────────────
        hasher  = hashlib.sha256()
        written = 0

        with open(file_path, "wb") as f:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum allowed size: {settings.max_file_size_mb} MB",
                    )
                hasher.update(chunk)
                f.write(chunk)

        content_hash = hasher.hexdigest()
        logger.info("File saved", filename=safe_name, bytes=written, hash=content_hash[:12])

        # ── Duplicate detection ─────────────────────────────────────────────
        if _check_duplicate(content_hash):
            logger.info("Duplicate upload skipped", filename=safe_name, hash=content_hash[:12])
            raise HTTPException(
                status_code=409,
                detail=f"'{safe_name}' is already indexed (identical content). No changes made.",
            )

        # ── Extract text ────────────────────────────────────────────────────
        text = await extract_text(file_path, mime_type=file.content_type)
        if not text or not text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from file")

        # Guard against token budget explosion from extremely long documents
        if len(text) > MAX_TEXT_LEN:
            logger.warning(
                "Extracted text truncated",
                filename=safe_name,
                original_len=len(text),
                truncated_to=MAX_TEXT_LEN,
            )
            text = text[:MAX_TEXT_LEN]

        # ── Chunk ───────────────────────────────────────────────────────────
        # ── V3: Contextual chunking (Anthropic method) — opt-in via .env ──────
        if settings.contextual_chunking_enabled:
            from services.chunking import contextual_chunk_text
            chunks = await contextual_chunk_text(text, filename=file.filename or "")
        else:
            chunks = chunk_text(text, filename=safe_name)
        if not chunks:
            raise HTTPException(status_code=422, detail="No content chunks generated")

        # ── Embed ───────────────────────────────────────────────────────────
        embeddings = await embed_texts(chunks)

        # ── Store in ChromaDB ───────────────────────────────────────────────
        doc_type = _detect_doc_type(safe_name)
        collection = get_collection()
        now = datetime.now(timezone.utc).isoformat()
        ids = [uuid.uuid4().hex for _ in chunks]
        metadatas = [
            {
                "source":       safe_name,
                "filename":     safe_name,
                "doc_type":     doc_type,
                "indexed_at":   now,
                "chunk_index":  i,
                "content_hash": content_hash,  # stored for duplicate detection
            }
            for i in range(len(chunks))
        ]

        collection.add(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metadatas)
        increment_documents(1)
        increment_chunks(len(chunks))

        logger.info("Document indexed", filename=safe_name, chunks=len(chunks), doc_type=doc_type)

        # ── V3: Invalidate caches (new doc may change answers) ──────────────
        try:
            from services.bm25_cache import get_bm25_cache
            get_bm25_cache().invalidate()
            # Rebuild async so next query gets fresh BM25
            import asyncio
            asyncio.create_task(get_bm25_cache().rebuild())
        except Exception as e:
            logger.warning("BM25 cache invalidation failed (non-critical)", error=str(e))

        try:
            from services.semantic_cache import get_semantic_cache
            get_semantic_cache().invalidate()
        except Exception as e:
            logger.warning("Semantic cache invalidation failed (non-critical)", error=str(e))

        # ── V2: OKF Dual-Index (background, non-blocking) ───────────────────
        okf_path = None
        try:
            from services.okf_writer import auto_create_okf
            okf_path = await auto_create_okf(
                source_path=file_path,
                extracted_text=text,
                doc_type=doc_type,
                safe_name=safe_name,
            )
            if okf_path:
                logger.info("OKF document auto-created", path=okf_path)
        except Exception as e:
            logger.warning("OKF auto-create failed (non-critical)", error=str(e))

        return UploadResponse(
            filename=safe_name,
            chunks_created=len(chunks),
            doc_type=doc_type,
            message=(
                f"Successfully indexed {len(chunks)} chunks from '{safe_name}'"
                + (f" · OKF document created at knowledge/{okf_path}" if okf_path else "")
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Upload failed", error=str(e), filename=safe_name)
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        pass


@router.post("/chat/parse-file", response_model=ParseResponse)
@limiter.limit("20/minute")
async def parse_ephemeral_document(request: Request, file: UploadFile = File(...)) -> ParseResponse:
    """Extract text from a file uploaded strictly for a single chat context. 
    Does NOT store the file in ChromaDB or the global knowledge base."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    safe_name = _sanitize_filename(file.filename)
    suffix    = Path(safe_name).suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    upload_dir = Path(settings.upload_dir) / "temp"
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{uuid.uuid4().hex}_{safe_name}"

    try:
        written = 0
        with open(file_path, "wb") as f:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum allowed size: {settings.max_file_size_mb} MB",
                    )
                f.write(chunk)

        text = await extract_text(file_path, mime_type=file.content_type)
        if not text or not text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from file")

        # Guard against massive token usage
        if len(text) > MAX_TEXT_LEN:
            text = text[:MAX_TEXT_LEN]

        return ParseResponse(
            filename=safe_name,
            content=text,
            mime_type=file.content_type or "application/octet-stream"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Ephemeral parse failed", error=str(e), filename=safe_name)
        raise HTTPException(status_code=500, detail=f"Parse failed: {str(e)}")
    finally:
        # Clean up ephemeral file
        if file_path.exists():
            try:
                file_path.unlink()
            except Exception as e:
                logger.warning("Failed to delete temp file", path=str(file_path), error=str(e))
