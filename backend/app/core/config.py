"""
Application configuration. Fail-closed: required secrets must be supplied.
"""

from typing import List
from typing_extensions import Annotated
from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict, NoDecode


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "Ulwandle Tech - RAC"
    APP_VERSION: str = "1.1.0"
    APP_ENV: str = Field(default="development", pattern="^(development|staging|production)$")
    DEBUG: bool = False

    # Required secrets — no defaults
    SECRET_KEY: SecretStr
    DATABASE_URL: SecretStr
    ANTHROPIC_API_KEY: SecretStr

    # JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TTL_SECONDS: int = 900               # 15 min
    JWT_REFRESH_TTL_SECONDS: int = 60 * 60 * 24 * 7 # 7 days

    # API / network
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    CORS_ORIGINS: Annotated[List[str], NoDecode] = []
    TRUSTED_HOSTS: Annotated[List[str], NoDecode] = []
    MAX_REQUEST_BYTES: int = 1_000_000  # 1 MB
    BEHIND_PROXY: bool = True

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Claude
    CLAUDE_MODEL: str = "claude-sonnet-4-6"
    CLAUDE_DECISION_MODEL: str = "claude-opus-4-7"
    CLAUDE_TIMEOUT_SECONDS: float = 30.0

    # SANS 241 thresholds
    PH_MIN: float = 6.0
    PH_MAX: float = 9.5
    TDS_MAX: float = 1200.0
    TURBIDITY_MAX: float = 5.0

    # Anomaly / leak detection
    LEAK_THRESHOLD_PERCENT: float = 15.0
    ANOMALY_DETECTION_SENSITIVITY: float = 0.85

    # Kill switch — disabled by default; require explicit enablement per env
    VALVE_CONTROL_ENABLED: bool = False
    DUAL_CONTROL_REQUIRED: bool = True
    PROPOSAL_TTL_SECONDS: int = 600       # 10 min window to approve+execute
    NONCE_REPLAY_WINDOW_SECONDS: int = 900

    # Sensor ingestion machine auth
    SENSOR_INGEST_HMAC_REQUIRED: bool = True
    SENSOR_HMAC_TIMESTAMP_SKEW_SECONDS: int = 120

    # Rate limiting
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_VALVE: str = "20/hour"
    RATE_LIMIT_INGEST: str = "600/minute"

    # Notifications
    ALERT_EMAIL: str = "ronaldtrqobolo@outlook.com"
    NOTIFICATION_WEBHOOK_URL: str = ""
    EMPLOYEE_NOTIFICATION_ENABLED: bool = True

    # SMTP for alert dispatch (optional — if SMTP_HOST is empty, email is skipped)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: SecretStr = SecretStr("")
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True
    # Minimum alert level that triggers a notification dispatch.
    # One of: info, warning, critical, emergency.
    NOTIFICATION_MIN_LEVEL: str = "warning"

    # Scraper resilience
    SCRAPER_RETRY_ATTEMPTS: int = 3
    SCRAPER_RETRY_BASE_DELAY_SECONDS: float = 2.0

    # Observability
    ENABLE_METRICS: bool = True
    METRICS_PATH: str = "/metrics"
    LOG_LEVEL: str = "INFO"

    @field_validator("CORS_ORIGINS", "TRUSTED_HOSTS", mode="before")
    @classmethod
    def _split_csv(cls, v):
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return v or []

    def assert_strong_secrets(self) -> None:
        """Refuse to boot with weak secrets in non-dev environments."""
        sk = self.SECRET_KEY.get_secret_value()
        if len(sk) < 32:
            raise ValueError("SECRET_KEY must be >= 32 characters")
        if self.APP_ENV != "development":
            if self.DEBUG:
                raise ValueError("DEBUG must be False outside development")
            if not self.CORS_ORIGINS:
                raise ValueError("CORS_ORIGINS must be set in non-dev environments")
            forbidden = {"change-this-in-production", "your-secret-key-change-in-production"}
            if sk in forbidden:
                raise ValueError("SECRET_KEY is using a known placeholder value")


settings = Settings()
settings.assert_strong_secrets()
