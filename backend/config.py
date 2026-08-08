from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    # ── LLM Provider ────────────────────────────────────────────────────────
    # Groq API configuration (OpenAI-compatible)
    groq_api_key: str = Field(..., env="GROQ_API_KEY")
    llm_chat_model: str = Field(default="llama-3.3-70b-versatile", env="LLM_CHAT_MODEL")
    llm_base_url: str = Field(default="https://api.groq.com/openai/v1", env="LLM_BASE_URL")

    # ── ChromaDB (local PersistentClient — no Docker needed) ────────────────
    chroma_collection: str = "engineer_hub"
    chroma_persist_dir: str = Field(default="./vectorstore", env="CHROMA_PERSIST_DIR")

    # ── Upload ───────────────────────────────────────────────────────────────
    upload_dir: str = Field(default="./uploads", env="UPLOAD_DIR")
    max_file_size_mb: int = 50

    # ── GitHub ───────────────────────────────────────────────────────────────
    github_token: str = Field(default="", env="GITHUB_TOKEN")

    # ── Chunking ─────────────────────────────────────────────────────────────
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # ── Retrieval ─────────────────────────────────────────────────────────────
    top_k_vector: int = 10
    top_k_final: int = 7
    mmr_diversity: float = 0.3

    # ── Logging ───────────────────────────────────────────────────────────────
    log_level: str = Field(default="INFO", env="LOG_LEVEL")

    # ── Security ──────────────────────────────────────────────────────────────
    api_key: str = Field(default="", env="API_KEY")
    cors_origins: str = Field(default="http://localhost:3000", env="CORS_ORIGINS")

    # ── V2: OKF (Open Knowledge Format — Google) ─────────────────────────────
    okf_enabled: bool = Field(default=True, env="OKF_ENABLED")
    okf_knowledge_dir: str = Field(
        default=str(Path(__file__).parent.parent / "knowledge"),
        env="OKF_KNOWLEDGE_DIR"
    )
    okf_trust_boost: float = Field(default=1.2, env="OKF_TRUST_BOOST")
    okf_min_score: float = Field(default=0.25, env="OKF_MIN_SCORE")
    okf_auto_create_on_upload: bool = Field(default=True, env="OKF_AUTO_CREATE_ON_UPLOAD")


    # ── V2: Multi-RAG Feature Flags ──────────────────────────────────────────
    multi_query_enabled: bool = Field(default=True, env="MULTI_QUERY_ENABLED")
    multi_query_count: int = Field(default=3, env="MULTI_QUERY_COUNT")
    crag_enabled: bool = Field(default=True, env="CRAG_ENABLED")
    self_rag_critique: bool = Field(default=True, env="SELF_RAG_CRITIQUE")
    web_search_fallback: bool = Field(default=False, env="WEB_SEARCH_FALLBACK")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
