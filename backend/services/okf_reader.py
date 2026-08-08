"""OKF Reader Service — Google Open Knowledge Format v0.2 integration.

Implements deterministic knowledge retrieval from a structured directory
of Markdown files with YAML frontmatter. Complements (never replaces)
ChromaDB vector search — used for canonical, high-trust engineering knowledge.

Spec: https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf

Key design decisions:
- Lazy-loaded, in-memory document cache (fast after first load)
- Scoring: tag match > type-intent match > title match > content match
- Trust-level boosts for verified documents
- Staleness penalty for docs older than 90 days
- Async-safe: all blocking I/O runs in asyncio.to_thread
"""
import asyncio
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import frontmatter
import structlog

from config import get_settings

logger = structlog.get_logger()
settings = get_settings()

# OKF type → query intent keyword mapping
# Used to route "how do I rollback?" → Runbook type
TYPE_INTENT_MAP: dict[str, list[str]] = {
    "Runbook":        ["how to", "steps", "procedure", "run", "execute", "fix", "resolve", "repair", "restart"],
    "Playbook":       ["incident", "outage", "alert", "escalate", "on-call", "oncall", "response", "triage"],
    "IncidentReport": ["incident", "outage", "postmortem", "post-mortem", "root cause", "rca", "what happened", "timeline"],
    "Architecture":   ["architecture", "design", "service", "component", "diagram", "system", "infrastructure", "flow", "overview"],
    "Standard":       ["standard", "convention", "policy", "rule", "api", "contract", "spec", "versioning", "guidelines"],
    "Metric":         ["metric", "kpi", "measure", "dashboard", "analytics", "track", "monitor"],
    "Index":          [],  # Never returned in search results
}

STALENESS_THRESHOLD_DAYS = 90
MIN_CONFIDENCE_SCORE = 0.25


# ── Data Models ──────────────────────────────────────────────────────────────

@dataclass
class OKFDocument:
    """A parsed OKF v0.2 document with all frontmatter fields."""
    file_path: Path
    okf_type: str                                      # required per OKF spec
    title: str = ""
    description: str = ""
    tags: list[str] = field(default_factory=list)
    resource: str = ""
    timestamp: Optional[str] = None
    provenance: dict = field(default_factory=dict)
    trust: dict = field(default_factory=dict)
    content: str = ""                                  # Markdown body
    links: list[tuple[str, str]] = field(default_factory=list)  # [(text, path)]

    @property
    def source_id(self) -> str:
        """Unique stable identifier — relative path from knowledge root."""
        try:
            kb_dir = Path(settings.okf_knowledge_dir).resolve()
            return str(self.file_path.relative_to(kb_dir))
        except ValueError:
            return self.file_path.name

    @property
    def is_index(self) -> bool:
        return self.file_path.name == "index.md" or self.okf_type == "Index"

    @property
    def trust_level(self) -> str:
        """HIGH / MEDIUM / LOW — based on trust frontmatter field."""
        if self.trust.get("verified") is True:
            return "HIGH"
        if self.trust.get("author"):
            return "MEDIUM"
        return "LOW"

    @property
    def is_stale(self) -> bool:
        """True if doc has not been updated in >90 days."""
        if not self.timestamp:
            return False
        try:
            ts_str = str(self.timestamp).replace("Z", "+00:00")
            ts = datetime.fromisoformat(ts_str)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            return (datetime.now(timezone.utc) - ts).days > STALENESS_THRESHOLD_DAYS
        except (ValueError, AttributeError):
            return False

    @property
    def category(self) -> str:
        """Category folder name (e.g. 'runbooks', 'incidents')."""
        try:
            kb_dir = Path(settings.okf_knowledge_dir).resolve()
            rel = self.file_path.relative_to(kb_dir)
            parts = rel.parts
            return parts[0] if len(parts) > 1 else "general"
        except ValueError:
            return "general"


@dataclass
class OKFResult:
    """A scored retrieval result from the OKF knowledge layer."""
    document: OKFDocument
    score: float         # 0.0 – 1.0
    match_reason: str    # "tag_match" | "type_match" | "title_match" | "content_match"

    @property
    def confidence(self) -> int:
        return min(100, max(0, int(self.score * 100)))

    @property
    def content_preview(self) -> str:
        preview = self.document.content[:300].strip()
        return preview + ("…" if len(self.document.content) > 300 else "")


# ── OKF Reader ───────────────────────────────────────────────────────────────

class OKFReader:
    """
    Reads, caches, searches, and traverses the OKF knowledge bundle.

    The bundle is lazy-loaded on first search into an in-memory dict.
    All disk I/O runs in asyncio.to_thread to never block the event loop.
    """

    def __init__(self) -> None:
        self._cache: dict[str, OKFDocument] = {}
        self._loaded: bool = False

    # ── Loading ───────────────────────────────────────────────────────────────

    def _knowledge_dir(self) -> Path:
        return Path(settings.okf_knowledge_dir).resolve()

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return

        kb_dir = self._knowledge_dir()
        if not kb_dir.exists():
            logger.warning("OKF knowledge/ directory not found — creating it", path=str(kb_dir))
            kb_dir.mkdir(parents=True, exist_ok=True)
            self._loaded = True
            return

        count = 0
        for md_file in kb_dir.rglob("*.md"):
            try:
                post = frontmatter.load(str(md_file))
                okf_type = str(post.metadata.get("type", "Document"))

                if okf_type == "Index":
                    continue  # Index files are navigation only

                doc = OKFDocument(
                    file_path=md_file,
                    okf_type=okf_type,
                    title=str(post.metadata.get("title", md_file.stem)),
                    description=str(post.metadata.get("description", "")),
                    tags=[str(t) for t in post.metadata.get("tags", [])],
                    resource=str(post.metadata.get("resource", "")),
                    timestamp=post.metadata.get("timestamp"),
                    provenance=dict(post.metadata.get("provenance") or {}),
                    trust=dict(post.metadata.get("trust") or {}),
                    content=str(post.content),
                    links=self._extract_links(str(post.content)),
                )
                self._cache[doc.source_id] = doc
                count += 1
            except Exception as e:
                logger.warning("OKF parse error — skipping file", file=str(md_file), error=str(e))

        self._loaded = True
        logger.info("OKF knowledge bundle loaded", documents=count, path=str(kb_dir))

    @staticmethod
    def _extract_links(content: str) -> list[tuple[str, str]]:
        """Extract all `[text](path.md)` cross-links from Markdown body."""
        return re.findall(r'\[([^\]]+)\]\(([^)]+\.md)\)', content)

    # ── Scoring ───────────────────────────────────────────────────────────────

    _STOP_WORDS = frozenset({"the", "a", "an", "is", "it", "to", "how", "what",
                              "why", "when", "where", "which", "who", "do", "does",
                              "in", "of", "for", "with", "my", "our", "your"})

    def _tokenize(self, text: str) -> set[str]:
        return set(text.lower().split()) - self._STOP_WORDS

    def _score_document(
        self,
        doc: OKFDocument,
        query: str,
        query_tokens: set[str],
    ) -> tuple[float, str]:
        """Score a document against a query. Returns (score 0-1, match_reason)."""
        score = 0.0
        reason = "none"
        q = query.lower()

        # 1. Tag exact match — highest precision signal (weight: up to 0.90)
        doc_tags = {t.lower() for t in doc.tags}
        overlap = query_tokens & doc_tags
        if overlap:
            score = max(score, 0.5 + 0.4 * len(overlap) / max(len(doc_tags), 1))
            reason = "tag_match"

        # 2. Type-intent keyword match (weight: 0.70)
        intent_kws = TYPE_INTENT_MAP.get(doc.okf_type, [])
        if any(kw in q for kw in intent_kws):
            if 0.70 > score:
                score = 0.70
                reason = reason if reason != "none" else "type_match"

        # 3. Title token overlap (weight: up to 0.80)
        title_tokens = self._tokenize(doc.title)
        title_overlap = query_tokens & title_tokens
        if title_overlap:
            ts = 0.5 + 0.30 * len(title_overlap) / max(len(title_tokens), 1)
            if ts > score:
                score = ts
                reason = "title_match"

        # 4. Description match (weight: 0.45)
        if doc.description and any(t in doc.description.lower() for t in query_tokens):
            if 0.45 > score:
                score = 0.45
                reason = reason if reason != "none" else "desc_match"

        # 5. Content keyword scan — fallback (weight: up to 0.40)
        if score < 0.30:
            hits = sum(1 for t in query_tokens if t in doc.content.lower())
            if hits > 0:
                cs = 0.20 + 0.20 * hits / max(len(query_tokens), 1)
                if cs > score:
                    score = cs
                    reason = "content_match"

        # Apply trust / staleness modifiers
        if doc.trust_level == "HIGH" and score > 0:
            score = min(1.0, score * 1.15)
        elif doc.is_stale and score > 0:
            score *= 0.85

        return round(score, 4), reason

    # ── Public API ────────────────────────────────────────────────────────────

    async def search(
        self,
        query: str,
        top_k: int = 5,
        filter_type: Optional[str] = None,
    ) -> list[OKFResult]:
        """Search OKF bundle asynchronously. Returns ranked results."""
        return await asyncio.to_thread(self._search_sync, query, top_k, filter_type)

    def _search_sync(
        self,
        query: str,
        top_k: int,
        filter_type: Optional[str],
    ) -> list[OKFResult]:
        self._ensure_loaded()
        if not self._cache:
            return []

        query_tokens = self._tokenize(query)
        results: list[OKFResult] = []

        for doc in self._cache.values():
            if filter_type and doc.okf_type.lower() != filter_type.lower():
                continue
            score, reason = self._score_document(doc, query, query_tokens)
            if score >= MIN_CONFIDENCE_SCORE:
                results.append(OKFResult(document=doc, score=score, match_reason=reason))

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:top_k]

    async def get_document(self, source_id: str) -> Optional[OKFDocument]:
        """Fetch a specific OKF document by its relative path key."""
        await asyncio.to_thread(self._ensure_loaded)
        return self._cache.get(source_id)

    async def get_linked_documents(self, source_id: str) -> list[OKFDocument]:
        """Return documents that are cross-linked from the given document."""
        doc = await self.get_document(source_id)
        if not doc:
            return []

        linked: list[OKFDocument] = []
        base = Path(source_id).parent

        for _text, link_path in doc.links:
            if link_path.startswith("http"):
                continue
            try:
                resolved = str((base / link_path).resolve().relative_to(Path(".")))
                resolved = resolved.replace("\\", "/")
                if resolved in self._cache:
                    linked.append(self._cache[resolved])
            except (ValueError, Exception):
                pass

        return linked

    async def all_documents(self) -> list[OKFDocument]:
        """Return all non-index documents (for Knowledge Studio browser)."""
        await asyncio.to_thread(self._ensure_loaded)
        return list(self._cache.values())

    async def all_types(self) -> list[str]:
        """Return sorted list of all OKF types in the bundle."""
        docs = await self.all_documents()
        return sorted({d.okf_type for d in docs})

    async def all_tags(self) -> dict[str, int]:
        """Return tag → count map for filter UI."""
        docs = await self.all_documents()
        counts: dict[str, int] = {}
        for doc in docs:
            for tag in doc.tags:
                counts[tag] = counts.get(tag, 0) + 1
        return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))

    def reload(self) -> None:
        """Force-reload the bundle from disk (call after writing new OKF files)."""
        self._cache.clear()
        self._loaded = False
        self._ensure_loaded()
        logger.info("OKF bundle reloaded", documents=len(self._cache))


# ── Singleton ─────────────────────────────────────────────────────────────────

_okf_reader: Optional[OKFReader] = None


def get_okf_reader() -> OKFReader:
    """Return the shared OKFReader singleton (created on first call)."""
    global _okf_reader
    if _okf_reader is None:
        _okf_reader = OKFReader()
    return _okf_reader
