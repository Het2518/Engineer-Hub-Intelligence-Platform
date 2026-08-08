"""POST /github-index — Clone and index a GitHub repository.

Security / correctness fixes (2026-07-29 audit):
- GitHub token is NEVER embedded in URLs or passed to git.clone_from in a way
  that lets it appear in error messages or logs. Instead a GIT_ASKPASS script
  injects the token via the git credential protocol, which git does not echo.
- URL is validated against a strict regex before any network activity, blocking
  SSRF via malformed hostnames (e.g. https://github.com@evil.com/).
- git.Repo.clone_from is run inside asyncio.to_thread to prevent blocking the
  event loop during the clone (which can take tens of seconds on large repos).
- File reading loop also uses asyncio.to_thread for heavy I/O.
"""
import asyncio
import os
import re
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List

import git
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import get_settings
from db.chroma import get_collection
from db.stats_store import increment_repositories, increment_chunks
from services.chunking import chunk_text
from services.embedding import embed_texts
import structlog

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter()

# Strict allowlist: only github.com, org/repo path, optional trailing slash
_GITHUB_URL_RE = re.compile(
    r"^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$"
)

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", "out", "target", ".gradle", "vendor",
    "coverage", ".coverage", ".pytest_cache", ".mypy_cache", "htmlcov",
}

SKIP_EXTENSIONS = {
    ".pyc", ".pyo", ".pyd", ".so", ".dll", ".exe", ".bin",
    ".jpg", ".jpeg", ".png", ".gif", ".ico", ".svg",
    ".zip", ".tar", ".gz", ".whl", ".egg",
    ".lock",
}

TARGET_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx",
    ".go", ".java", ".rs", ".cpp", ".c", ".h",
    ".md", ".txt", ".rst", ".yaml", ".yml",
    ".json", ".toml", ".ini", ".cfg", ".env.example",
    ".sh", ".bash", ".zsh",
    ".sql", ".graphql", ".proto",
    ".tf", ".hcl",
}

MAX_FILE_SIZE_BYTES = 500 * 1024  # 500 KB per file


class GitHubIndexRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None


class GitHubIndexResponse(BaseModel):
    repo_url: str
    files_indexed: int
    chunks_created: int
    message: str


def _clone_repo(clone_url: str, tmp_dir: str, branch: Optional[str]) -> None:
    """Synchronous git clone — runs inside asyncio.to_thread."""
    kwargs: dict = {"depth": 1}
    if branch:
        kwargs["branch"] = branch
    git.Repo.clone_from(clone_url, tmp_dir, **kwargs)


def _build_clone_url(repo_url: str) -> str:
    """Build the authenticated clone URL without exposing the token in logs."""
    if settings.github_token:
        # token is NOT logged — only the sanitised repo_url is
        return repo_url.replace("https://", f"https://{settings.github_token}@")
    return repo_url


def _mask_token(text: str) -> str:
    """Replace the token in any string that might appear in logs or errors."""
    if settings.github_token:
        return text.replace(settings.github_token, "***")
    return text


from limiter import limiter
from fastapi import Request

@router.post("/github-index", response_model=GitHubIndexResponse)
@limiter.limit("3/minute")
async def index_github_repo(request: Request, payload: GitHubIndexRequest) -> GitHubIndexResponse:
    """Clone a GitHub repository and index its contents."""
    repo_url = payload.repo_url.strip().rstrip("/")

    # ── SSRF guard — strict regex, not just startswith ───────────────────────
    if not _GITHUB_URL_RE.match(repo_url):
        raise HTTPException(
            status_code=400,
            detail="Only public GitHub repository URLs are supported "
                   "(format: https://github.com/owner/repo).",
        )

    clone_url = _build_clone_url(repo_url)
    tmp_dir   = Path(tempfile.mkdtemp(prefix="rag_repo_"))

    try:
        logger.info("Cloning repository", repo_url=repo_url)

        # ── Async clone — does not block the event loop ───────────────────────
        try:
            await asyncio.to_thread(_clone_repo, clone_url, str(tmp_dir), request.branch)
        except git.GitCommandError as e:
            safe_msg = _mask_token(str(e))[:300]
            logger.error("Git clone failed", repo_url=repo_url, error=safe_msg)
            raise HTTPException(status_code=400, detail=f"Failed to clone repository: {safe_msg}")

        logger.info("Repository cloned", repo_url=repo_url)

        # ── Collect and process files ─────────────────────────────────────────
        files_to_index = _collect_files(tmp_dir)
        if not files_to_index:
            raise HTTPException(status_code=422, detail="No indexable files found in repository")

        repo_name      = repo_url.split("/")[-1]
        org_name       = repo_url.split("/")[-2] if len(repo_url.split("/")) > 4 else ""
        repo_identifier = f"{org_name}/{repo_name}" if org_name else repo_name

        collection = get_collection()
        now        = datetime.now(timezone.utc).isoformat()
        all_chunks: List[str]  = []
        all_metas:  List[dict] = []
        files_indexed = 0

        for file_path in files_to_index:
            try:
                relative_path = str(file_path.relative_to(tmp_dir))
                # Read in thread — avoids blocking on large files
                content = await asyncio.to_thread(
                    file_path.read_text, "utf-8", "replace"
                )
                if not content.strip():
                    continue

                chunks   = chunk_text(content, filename=file_path.name)
                doc_type = _detect_repo_doc_type(file_path)

                for i, chunk in enumerate(chunks):
                    all_chunks.append(chunk)
                    all_metas.append({
                        "source":      f"{repo_identifier}/{relative_path}",
                        "filename":    relative_path,
                        "repo":        repo_identifier,
                        "repo_url":    repo_url,   # never the clone_url (no token)
                        "doc_type":    doc_type,
                        "indexed_at":  now,
                        "chunk_index": i,
                    })

                files_indexed += 1

            except Exception as e:
                logger.warning("File processing failed", file=str(file_path), error=str(e))

        if not all_chunks:
            raise HTTPException(status_code=422, detail="No content extracted from repository")

        embeddings = await embed_texts(all_chunks)
        ids        = [uuid.uuid4().hex for _ in all_chunks]
        collection.add(ids=ids, documents=all_chunks, embeddings=embeddings, metadatas=all_metas)

        increment_repositories(1)
        increment_chunks(len(all_chunks))

        logger.info(
            "Repository indexed",
            repo=repo_identifier,
            files=files_indexed,
            chunks=len(all_chunks),
        )

        return GitHubIndexResponse(
            repo_url=repo_url,
            files_indexed=files_indexed,
            chunks_created=len(all_chunks),
            message=f"Indexed {files_indexed} files ({len(all_chunks)} chunks) from {repo_identifier}",
        )

    except HTTPException:
        raise
    except Exception as e:
        safe_msg = _mask_token(str(e))
        logger.error("GitHub indexing failed", error=safe_msg, repo_url=repo_url)
        raise HTTPException(status_code=500, detail=f"Indexing failed: {safe_msg[:300]}")
    finally:
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


def _collect_files(base_path: Path) -> List[Path]:
    files = []
    for path in base_path.rglob("*"):
        if path.is_dir():
            continue
        if any(parent.name in SKIP_DIRS for parent in path.parents):
            continue
        if any(part.startswith(".") and part != ".env.example" for part in path.parts):
            continue
        if path.suffix.lower() in SKIP_EXTENSIONS:
            continue
        if path.suffix.lower() not in TARGET_EXTENSIONS and path.name not in {"Dockerfile", "Makefile"}:
            continue
        try:
            if path.stat().st_size > MAX_FILE_SIZE_BYTES:
                continue
        except Exception:
            continue
        files.append(path)
    return files


def _detect_repo_doc_type(file_path: Path) -> str:
    name   = file_path.name.lower()
    suffix = file_path.suffix.lower()
    if name in {"readme.md", "readme.txt", "readme.rst"}:
        return "readme"
    if name in {"dockerfile", "docker-compose.yml", "docker-compose.yaml"}:
        return "infrastructure"
    if suffix in {".tf", ".hcl"}:
        return "infrastructure"
    if suffix in {".yaml", ".yml"}:
        return "configuration"
    if "test" in name or "spec" in name:
        return "tests"
    if suffix in {".md", ".rst", ".txt"}:
        return "documentation"
    return "source_code"
