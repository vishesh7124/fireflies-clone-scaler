"""Application configuration (env-driven)."""

from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Backend settings — see backend/.env.example for the full list."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQLite
    fi_reflies_db_path: str = "data/fireflies.db"
    media_dir: str = "data/media"

    # Boot behaviour
    seed_on_start: bool = True

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Groq is opt-in: a key alone must not send meeting content externally.
    llm_allow_external: bool = False
    llm_api_key: SecretStr = SecretStr("")
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_model: str = ""
    llm_response_format: Literal["json_object", "json_schema"] = "json_object"
    llm_timeout_seconds: float = Field(default=15, gt=0, le=120)
    llm_total_timeout_seconds: float = Field(default=30, gt=0, le=180)
    llm_max_retries: int = Field(default=1, ge=0, le=3)
    llm_max_input_chars: int = Field(default=48000, ge=1000, le=500000)
    llm_max_output_tokens: int = Field(default=2048, ge=128, le=16384)
    llm_max_response_bytes: int = Field(default=200000, ge=1000, le=2000000)
    llm_max_concurrent: int = Field(default=2, ge=1, le=10)
    llm_requests_per_minute: int = Field(default=20, ge=1, le=300)
    llm_requests_per_day: int = Field(default=200, ge=1, le=10000)
    llm_tokens_per_day: int = Field(default=1000000, ge=1000, le=100000000)
    ai_requests_per_ip_minute: int = Field(default=30, ge=1, le=300)

    # Lexical indexing is lightweight; model inference is separately opt-in.
    rag_indexing_enabled: bool = True
    rag_inference_mode: Literal["disabled", "local", "remote"] = "disabled"
    rag_allow_external: bool = False
    rag_allow_model_download: bool = False
    rag_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    rag_embedding_revision: str = ""
    rag_embedding_dimensions: int = Field(default=384, ge=1, le=4096)
    rag_reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    rag_reranker_revision: str = ""
    rag_worker_url: str = ""
    rag_worker_key: SecretStr = SecretStr("")
    rag_timeout_seconds: float = Field(default=15, gt=0, le=120)
    rag_chunk_chars: int = Field(default=800, ge=100, le=4000)
    rag_overlap_turns: int = Field(default=1, ge=0, le=3)
    rag_batch_size: int = Field(default=8, ge=1, le=32)
    rag_poll_seconds: float = Field(default=5, ge=1, le=300)
    rag_retry_seconds: float = Field(default=60, ge=5, le=3600)
    rag_max_index_seconds: float = Field(default=60, ge=5, le=600)
    rag_candidates: int = Field(default=24, ge=1, le=100)
    rag_rerank_candidates: int = Field(default=12, ge=1, le=32)
    rag_min_similarity: float = Field(default=0.25, ge=-1, le=1)
    workspace_timezone: str = "UTC"
    global_chat_timeout_seconds: float = Field(default=60, ge=5, le=180)
    global_context_chars: int = Field(default=20000, ge=2000, le=100000)
    global_catalog_limit: int = Field(default=80, ge=1, le=500)
    global_meeting_limit: int = Field(default=4, ge=1, le=10)
    global_task_limit: int = Field(default=50, ge=1, le=100)

    @field_validator("workspace_timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError:
            raise ValueError("WORKSPACE_TIMEZONE must be a valid IANA timezone") from None
        return value

    @field_validator("rag_worker_url")
    @classmethod
    def secure_worker_url(cls, value: str) -> str:
        if not value:
            return value
        from urllib.parse import urlsplit
        url = urlsplit(value)
        local_http = url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1", "::1"}
        if (url.scheme != "https" and not local_http) or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise ValueError("RAG_WORKER_URL requires HTTPS, or loopback HTTP, without credentials/query")
        return value.rstrip("/")

    @field_validator("llm_base_url")
    @classmethod
    def secure_llm_url(cls, value: str) -> str:
        from urllib.parse import urlsplit
        url = urlsplit(value)
        if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise ValueError("LLM_BASE_URL must be an HTTPS URL without credentials, query, or fragment")
        return value.rstrip("/")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_enabled(self) -> bool:
        return self.llm_allow_external and bool(self.llm_api_key.get_secret_value().strip()) and bool(self.llm_model.strip())


settings = Settings()
