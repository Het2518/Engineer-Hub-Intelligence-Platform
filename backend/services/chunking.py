"""Document chunking service using LangChain text splitters."""
from langchain_text_splitters import RecursiveCharacterTextSplitter, MarkdownHeaderTextSplitter
from config import get_settings
import structlog

logger = structlog.get_logger()
settings = get_settings()


def chunk_text(text: str, filename: str = "") -> list[str]:
    """Split text into chunks with smart splitting based on file type."""
    if not text or not text.strip():
        return []

    # Use markdown-aware splitting for .md files
    if filename.lower().endswith((".md", ".markdown")):
        return _chunk_markdown(text)

    return _chunk_generic(text)


def _chunk_generic(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_text(text)
    # Filter empty chunks
    return [c.strip() for c in chunks if c.strip() and len(c.strip()) > 50]


def _chunk_markdown(text: str) -> list[str]:
    """Split markdown with header awareness, then further chunk large sections."""
    headers_to_split_on = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
    ]
    try:
        md_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=headers_to_split_on,
            strip_headers=False,
        )
        docs = md_splitter.split_text(text)
        chunks = []
        char_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        for doc in docs:
            content = doc.page_content
            if len(content) > settings.chunk_size:
                sub = char_splitter.split_text(content)
                chunks.extend(sub)
            else:
                if content.strip():
                    chunks.append(content)
        return [c.strip() for c in chunks if c.strip() and len(c.strip()) > 50]
    except Exception:
        return _chunk_generic(text)
