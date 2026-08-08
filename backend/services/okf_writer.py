"""OKF Writer Service — Auto-generate OKF v0.2 documents from uploaded files.

When a user uploads a Runbook, Playbook, or Incident Report, this service
automatically creates an OKF-compliant Markdown file in the knowledge/ bundle,
in addition to the normal ChromaDB vector indexing.

This gives every structured document BOTH:
  - Deterministic OKF retrieval (exact content, high trust)
  - Semantic ChromaDB retrieval (fuzzy search, broad reach)
"""
import asyncio
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import frontmatter
import structlog

from config import get_settings

logger = structlog.get_logger()
settings = get_settings()

# Map ChromaDB doc_type → OKF type
DOC_TYPE_TO_OKF: dict[str, str] = {
    "runbook":          "Runbook",
    "incident_report":  "IncidentReport",
    "architecture":     "Architecture",
    "architecture_diagram": "Architecture",
    "readme":           "Standard",
    "documentation":    "Standard",
}

# Map OKF type → knowledge/ subdirectory
OKF_TYPE_TO_DIR: dict[str, str] = {
    "Runbook":          "runbooks",
    "Playbook":         "playbooks",
    "IncidentReport":   "incidents",
    "Architecture":     "architecture",
    "Standard":         "standards",
}

# Max chars for OKF body content (OKF docs should be concise)
OKF_MAX_CONTENT_CHARS = 5000


def _slugify(name: str) -> str:
    """Convert a filename or title to a URL-safe slug."""
    stem = Path(name).stem
    slug = re.sub(r'[^a-z0-9]+', '-', stem.lower()).strip('-')
    return slug or "document"


def _extract_title(stem: str) -> str:
    """Convert a filename stem to a readable title."""
    return re.sub(r'[-_]+', ' ', stem).strip().title()


def _infer_tags(doc_type: str, safe_name: str) -> list[str]:
    """Generate sensible default tags from filename and doc_type."""
    tags = [doc_type.replace('_', '-')]
    name_lower = safe_name.lower()

    keyword_tags = {
        "database": ["database"],
        "db": ["database"],
        "deploy": ["deploy", "ci-cd"],
        "rollback": ["rollback"],
        "incident": ["incident"],
        "outage": ["outage"],
        "migration": ["migration"],
        "auth": ["auth", "security"],
        "api": ["api"],
        "k8s": ["kubernetes"],
        "kubernetes": ["kubernetes"],
        "aws": ["aws", "cloud"],
        "gcp": ["gcp", "cloud"],
    }

    for keyword, tag_list in keyword_tags.items():
        if keyword in name_lower:
            tags.extend(t for t in tag_list if t not in tags)

    return tags[:8]  # cap at 8 tags per OKF spec recommendation


async def auto_create_okf(
    source_path: Path,
    extracted_text: str,
    doc_type: str,
    safe_name: str,
) -> Optional[str]:
    """
    Auto-generate an OKF-compliant .md file from an uploaded document.

    Returns the relative source_id path within the knowledge/ bundle,
    or None if this doc_type doesn't warrant OKF creation.
    """
    if not settings.okf_auto_create_on_upload:
        return None

    okf_type = DOC_TYPE_TO_OKF.get(doc_type)
    if not okf_type:
        logger.debug("OKF auto-create skipped — doc_type not mapped", doc_type=doc_type)
        return None

    kb_dir = Path(settings.okf_knowledge_dir).resolve()
    category_dir = OKF_TYPE_TO_DIR.get(okf_type, "general")
    output_dir = kb_dir / category_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    slug = _slugify(safe_name)
    okf_path = output_dir / f"{slug}.md"

    # Don't overwrite manually-curated OKF docs
    if okf_path.exists():
        logger.info("OKF doc already exists — skipping auto-create", path=str(okf_path))
        return None

    # Build OKF v0.2 frontmatter
    title = _extract_title(Path(safe_name).stem)
    tags = _infer_tags(doc_type, safe_name)
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    metadata = {
        "type": okf_type,
        "title": title,
        "description": f"Auto-generated from uploaded file: {safe_name}",
        "tags": tags,
        "timestamp": now_iso,
        "provenance": {
            "source": safe_name,
            "ingestion": "auto-upload",
        },
        "trust": {
            "author": "auto-ingestion",
            "verified": False,  # Requires human review to set True
        },
    }

    # Trim content to OKF_MAX_CONTENT_CHARS (OKF docs are concise summaries)
    content = extracted_text.strip()
    if len(content) > OKF_MAX_CONTENT_CHARS:
        content = content[:OKF_MAX_CONTENT_CHARS].rstrip()
        content += (
            "\n\n---\n*Content truncated at 5,000 chars. "
            "Full document is indexed in the vector knowledge base. "
            "Edit this file to add curated content and set `trust.verified: true`.*"
        )

    post = frontmatter.Post(content, **metadata)
    relative_path = str(Path(category_dir) / f"{slug}.md")

    await asyncio.to_thread(_write_file, okf_path, post)

    # Reload OKF reader so the new doc is searchable immediately
    from services.okf_reader import get_okf_reader
    get_okf_reader().reload()

    logger.info(
        "OKF document auto-created",
        path=relative_path,
        type=okf_type,
        title=title,
    )
    return relative_path


def _write_file(path: Path, post: frontmatter.Post) -> None:
    """Synchronous write — runs in thread pool via asyncio.to_thread."""
    path.write_text(frontmatter.dumps(post), encoding="utf-8")


async def create_okf_document(
    okf_type: str,
    title: str,
    description: str,
    tags: list[str],
    content: str,
    resource: str = "",
    trust_verified: bool = False,
    author: str = "",
) -> str:
    """
    Create a new OKF document programmatically (used by the Knowledge Studio UI).
    Returns the relative source_id of the new document.
    """
    kb_dir = Path(settings.okf_knowledge_dir).resolve()
    category_dir = OKF_TYPE_TO_DIR.get(okf_type, "general")
    output_dir = kb_dir / category_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    slug = _slugify(title)
    okf_path = output_dir / f"{slug}.md"

    # Ensure unique filename
    counter = 1
    while okf_path.exists():
        okf_path = output_dir / f"{slug}-{counter}.md"
        counter += 1

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    metadata = {
        "type": okf_type,
        "title": title,
        "description": description,
        "tags": tags,
        "timestamp": now_iso,
        "provenance": {"source": "Knowledge Studio"},
        "trust": {
            "author": author or "engineering-team",
            "verified": trust_verified,
        },
    }
    if resource:
        metadata["resource"] = resource

    post = frontmatter.Post(content, **metadata)
    await asyncio.to_thread(_write_file, okf_path, post)

    from services.okf_reader import get_okf_reader
    get_okf_reader().reload()

    relative_path = str(Path(category_dir) / okf_path.name)
    logger.info("OKF document created via Knowledge Studio", path=relative_path, type=okf_type)
    return relative_path


async def update_okf_document(
    source_id: str,
    title: str,
    description: str,
    tags: list[str],
    content: str,
    resource: str = "",
    trust_verified: bool = False,
    author: str = "",
) -> bool:
    """Update an existing OKF document. Returns True on success."""
    kb_dir = Path(settings.okf_knowledge_dir).resolve()
    okf_path = kb_dir / source_id

    if not okf_path.exists():
        logger.warning("OKF update failed — file not found", source_id=source_id)
        return False

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        existing = frontmatter.load(str(okf_path))
        existing.metadata.update({
            "title": title,
            "description": description,
            "tags": tags,
            "timestamp": now_iso,
            "trust": {
                "author": author or existing.metadata.get("trust", {}).get("author", ""),
                "verified": trust_verified,
            },
        })
        if resource:
            existing.metadata["resource"] = resource
        existing.content = content

        await asyncio.to_thread(_write_file, okf_path, existing)
        from services.okf_reader import get_okf_reader
        get_okf_reader().reload()
        logger.info("OKF document updated", source_id=source_id)
        return True
    except Exception as e:
        logger.error("OKF update error", source_id=source_id, error=str(e))
        return False


async def delete_okf_document(source_id: str) -> bool:
    """Delete an OKF document. Returns True on success."""
    kb_dir = Path(settings.okf_knowledge_dir).resolve()
    okf_path = kb_dir / source_id

    if not okf_path.exists():
        return False

    try:
        await asyncio.to_thread(okf_path.unlink)
        from services.okf_reader import get_okf_reader
        get_okf_reader().reload()
        logger.info("OKF document deleted", source_id=source_id)
        return True
    except Exception as e:
        logger.error("OKF delete error", source_id=source_id, error=str(e))
        return False
