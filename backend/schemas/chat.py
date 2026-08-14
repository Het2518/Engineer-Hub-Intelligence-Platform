"""schemas/chat.py — Pydantic models for the chat API.

Centralised here so they can be shared between the chat router,
any future websocket handler, and test suites without importing
from the router module itself.
"""
from typing import Optional
from pydantic import BaseModel, Field

MAX_QUESTION_LENGTH = 4000


class AttachedFile(BaseModel):
    filename: str
    content: str
    mime_type: Optional[str] = None


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=MAX_QUESTION_LENGTH)
    stream: bool = True
    filter_doc_type: Optional[str] = None
    session_id: Optional[str] = None
    attached_files: Optional[list[AttachedFile]] = None


class RenameRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)


class Source(BaseModel):
    filename: str
    doc_type: str
    confidence: int
    content_preview: str
    is_okf: bool = False
    trust_level: str = ""
    okf_type: str = ""
    match_reason: str = ""


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    response_time_ms: float
