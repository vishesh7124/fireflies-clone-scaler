"""Application configuration (env-driven)."""

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

    # Optional LLM (any OpenAI-compatible endpoint)
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_enabled(self) -> bool:
        return bool(self.llm_api_key)


settings = Settings()
