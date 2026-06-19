"""POST /github-index — Clone and index a GitHub repository."""
import os
import uuid
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List

import git
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

from config import get_settings
from db.chroma import get_collection
from db.stats_store import increment_repositories, increment_chunks
from services.chunking import chunk_text
from services.embedding import embed_texts
import structlog

logger = structlog.get_logger()
settings = get_settings()
router = APIRouter()

# Files/dirs to skip during indexing
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", "out", "target", ".gradle", "vendor",
    "coverage", ".coverage", ".pytest_cache", ".mypy_cache", "htmlcov",
}

SKIP_EXTENSIONS = {
    ".pyc", ".pyo", ".pyd", ".so", ".dll", ".exe", ".bin",
    ".jpg", ".jpeg", ".png", ".gif", ".ico", ".svg",
    ".zip", ".tar", ".gz", ".whl", ".egg",
    ".lock",  # package lock files (too noisy)
}

TARGET_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx",
    ".go", ".java", ".rs", ".cpp", ".c", ".h",
    ".md", ".txt", ".rst", ".yaml", ".yml",
    ".json", ".toml", ".ini", ".cfg", ".env.example",
    ".sh", ".bash", ".zsh",
    ".sql", ".graphql", ".proto",
    ".tf", ".hcl",  # Terraform
    ".dockerfile", "Dockerfile", "Makefile",
}

MAX_FILE_SIZE_BYTES = 500 * 1024  # 500KB per file


class GitHubIndexRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None


class GitHubIndexResponse(BaseModel):
    repo_url: str
    files_indexed: int
    chunks_created: int
    message: str


@router.post("/github-index", response_model=GitHubIndexResponse)
async def index_github_repo(request: GitHubIndexRequest) -> GitHubIndexResponse:
    """Clone a GitHub repository and index its contents."""
    repo_url = str(request.repo_url).rstrip("/")

    # Validate URL format
    if not (repo_url.startswith("https://github.com/") or repo_url.startswith("http://github.com/")):
        raise HTTPException(status_code=400, detail="Only GitHub URLs are supported")

    # Add auth token for private repos
    clone_url = repo_url
    if settings.github_token:
        # Insert token into URL: https://token@github.com/...
        clone_url = repo_url.replace("https://", f"https://{settings.github_token}@")

    tmp_dir = Path(tempfile.mkdtemp(prefix="engineer_hub_repo_"))

    try:
        logger.info("Cloning repository", repo_url=repo_url)

        # Clone
        clone_kwargs = {"depth": 1}  # Shallow clone for speed
        if request.branch:
            clone_kwargs["branch"] = request.branch

        try:
            git.Repo.clone_from(clone_url, str(tmp_dir), **clone_kwargs)
        except git.GitCommandError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to clone repository: {str(e)[:200]}",
            )

        logger.info("Repository cloned", path=str(tmp_dir))

        # Collect files
        files_to_index = _collect_files(tmp_dir)
        logger.info("Files collected", count=len(files_to_index))

        if not files_to_index:
            raise HTTPException(status_code=422, detail="No indexable files found in repository")

        # Extract repo name from URL
        repo_name = repo_url.rstrip("/").split("/")[-1]
        org_name = repo_url.rstrip("/").split("/")[-2] if len(repo_url.split("/")) > 4 else ""
        repo_identifier = f"{org_name}/{repo_name}" if org_name else repo_name

        # Process files
        collection = get_collection()
        now = datetime.now(timezone.utc).isoformat()
        total_chunks = 0
        files_indexed = 0

        all_chunks = []
        all_metadatas = []

        for file_path in files_to_index:
            try:
                relative_path = str(file_path.relative_to(tmp_dir))
                content = file_path.read_text(encoding="utf-8", errors="replace")

                if not content.strip():
                    continue

                chunks = chunk_text(content, filename=file_path.name)
                if not chunks:
                    continue

                doc_type = _detect_repo_doc_type(file_path)

                for i, chunk in enumerate(chunks):
                    all_chunks.append(chunk)
                    all_metadatas.append({
                        "source": f"{repo_identifier}/{relative_path}",
                        "filename": f"{relative_path}",
                        "repo": repo_identifier,
                        "repo_url": repo_url,
                        "doc_type": doc_type,
                        "indexed_at": now,
                        "chunk_index": i,
                    })

                files_indexed += 1
                total_chunks += len(chunks)

            except Exception as e:
                logger.warning("File processing failed", file=str(file_path), error=str(e))
                continue

        if not all_chunks:
            raise HTTPException(status_code=422, detail="No content extracted from repository")

        # Embed in batches
        embeddings = await embed_texts(all_chunks)

        # Store all at once
        ids = [uuid.uuid4().hex for _ in all_chunks]
        collection.add(
            ids=ids,
            documents=all_chunks,
            embeddings=embeddings,
            metadatas=all_metadatas,
        )

        increment_repositories(1)
        increment_chunks(total_chunks)

        logger.info(
            "Repository indexed",
            repo=repo_identifier,
            files=files_indexed,
            chunks=total_chunks,
        )

        return GitHubIndexResponse(
            repo_url=repo_url,
            files_indexed=files_indexed,
            chunks_created=total_chunks,
            message=f"Successfully indexed {files_indexed} files ({total_chunks} chunks) from {repo_identifier}",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("GitHub indexing failed", error=str(e), repo_url=repo_url)
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")
    finally:
        # Cleanup cloned repo
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


def _collect_files(base_path: Path) -> List[Path]:
    """Walk directory and collect all indexable files."""
    files = []
    for path in base_path.rglob("*"):
        # Skip directories
        if path.is_dir():
            continue

        # Skip ignored directories (check all parents)
        skip = False
        for parent in path.parents:
            if parent.name in SKIP_DIRS:
                skip = True
                break
        if skip:
            continue

        # Skip hidden files and dirs
        if any(part.startswith(".") and part != ".env.example" for part in path.parts):
            continue

        # Skip unwanted extensions
        if path.suffix.lower() in SKIP_EXTENSIONS:
            continue

        # Only target known text file types
        filename = path.name
        if path.suffix.lower() not in TARGET_EXTENSIONS and filename not in {"Dockerfile", "Makefile"}:
            continue

        # Skip oversized files
        try:
            if path.stat().st_size > MAX_FILE_SIZE_BYTES:
                continue
        except Exception:
            continue

        files.append(path)

    return files


def _detect_repo_doc_type(file_path: Path) -> str:
    name = file_path.name.lower()
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
    if suffix in {".py", ".js", ".ts", ".go", ".java", ".rs"}:
        return "source_code"
    return "source_code"
