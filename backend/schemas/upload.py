"""schemas/upload.py — Pydantic models for the upload API."""
from pydantic import BaseModel


class UploadResponse(BaseModel):
    filename: str
    chunks_created: int
    doc_type: str
    message: str


class ParseResponse(BaseModel):
    filename: str
    content: str
    mime_type: str
