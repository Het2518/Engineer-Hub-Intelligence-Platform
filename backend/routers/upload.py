"""POST /upload — Ingest documents into the knowledge base."""
import uuid
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel

from config import get_settings
from db.chroma import get_collection
from db.stats_store import increment_documents, increment_chunks
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


class UploadResponse(BaseModel):
    filename: str
    chunks_created: int
    doc_type: str
    message: str


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)) -> UploadResponse:
    """Upload and index a document into the knowledge base."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Save uploaded file
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = upload_dir / safe_name

    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            if len(content) > settings.max_file_size_mb * 1024 * 1024:
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Max size: {settings.max_file_size_mb}MB",
                )
            f.write(content)

        logger.info("File saved", filename=file.filename, path=str(file_path))

        # Extract text
        text = await extract_text(file_path, mime_type=file.content_type)
        if not text or not text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from file")

        # Chunk
        chunks = chunk_text(text, filename=file.filename)
        if not chunks:
            raise HTTPException(status_code=422, detail="No content chunks generated")

        # Embed
        embeddings = await embed_texts(chunks)

        # Determine doc type
        doc_type = _detect_doc_type(file.filename)

        # Store in ChromaDB
        collection = get_collection()
        now = datetime.now(timezone.utc).isoformat()
        ids = [f"{uuid.uuid4().hex}" for _ in chunks]
        metadatas = [
            {
                "source": file.filename,
                "filename": file.filename,
                "doc_type": doc_type,
                "indexed_at": now,
                "chunk_index": i,
            }
            for i in range(len(chunks))
        ]

        collection.add(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        increment_documents(1)
        increment_chunks(len(chunks))

        logger.info(
            "Document indexed",
            filename=file.filename,
            chunks=len(chunks),
            doc_type=doc_type,
        )

        return UploadResponse(
            filename=file.filename,
            chunks_created=len(chunks),
            doc_type=doc_type,
            message=f"Successfully indexed {len(chunks)} chunks from {file.filename}",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Upload failed", error=str(e), filename=file.filename)
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        # Clean up temp file (keep original in uploads for reference)
        pass


def _detect_doc_type(filename: str) -> str:
    name = filename.lower()
    if any(kw in name for kw in ["incident", "postmortem", "outage", "alert"]):
        return "incident_report"
    if any(kw in name for kw in ["runbook", "playbook", "procedure"]):
        return "runbook"
    if any(kw in name for kw in ["readme", "setup", "install", "onboard"]):
        return "readme"
    if any(kw in name for kw in ["arch", "architecture", "diagram", "design"]):
        return "architecture"
    suffix = Path(filename).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg"}:
        return "architecture_diagram"
    if suffix == ".pdf":
        return "document"
    if suffix in {".md", ".markdown"}:
        return "documentation"
    return "document"
