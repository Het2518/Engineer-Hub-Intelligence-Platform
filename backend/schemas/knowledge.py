"""schemas/knowledge.py — Pydantic models for the OKF Knowledge API."""
from typing import Optional
from pydantic import BaseModel


class OKFDocumentSummary(BaseModel):
    source_id: str
    okf_type: str
    title: str
    description: str
    tags: list[str]
    resource: str
    timestamp: Optional[str]
    trust_level: str
    is_stale: bool
    category: str
    content_preview: str


class OKFDocumentFull(OKFDocumentSummary):
    content: str
    links: list[tuple[str, str]]
    provenance: dict
    trust: dict


class CreateDocumentRequest(BaseModel):
    okf_type: str
    title: str
    description: str = ""
    tags: list[str] = []
    content: str
    resource: str = ""
    trust_verified: bool = False
    author: str = ""


class UpdateDocumentRequest(BaseModel):
    title: str
    description: str = ""
    tags: list[str] = []
    content: str
    resource: str = ""
    trust_verified: bool = False
    author: str = ""
