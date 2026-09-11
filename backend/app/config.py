"""Application settings loaded from environment variables via pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────
    app_name: str = "Omni"
    debug: bool = False
    secret_key: str = "change-me-to-a-random-64-char-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # ── Database ─────────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://omni:omni@localhost:5432/omni_db"

    # ── Redis / Celery ───────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # ── AI / LLM ─────────────────────────────────────────────────────────
    use_mock_llm: bool = False
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-flash-lite-latest"
    openai_api_key: str | None = None
    llm_model: str = "gpt-4o"

    # ── Platform Delivery & Webhooks ─────────────────────────────────────

    # Slack
    slack_bot_token: str | None = None  # xoxb-...

    # Twilio (WhatsApp & SMS)
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_phone_number: str | None = None  # E.164 e.g. +14155238886

    # Messenger / Meta
    messenger_page_token: str | None = None     # Page Access Token
    messenger_app_secret: str | None = None     # App Secret
    messenger_verify_token: str = "omni-verify-token"  # Match in Meta webhook config

    # Email / SMTP (for sending replies)
    smtp_host: str | None = None       # e.g. smtp.gmail.com
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None  # Defaults to smtp_user if not set
    smtp_use_tls: bool = True

    # SendGrid (alternative to SMTP for outbound email)
    sendgrid_api_key: str | None = None

    # ── CORS ─────────────────────────────────────────────────────────────
    frontend_url: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
