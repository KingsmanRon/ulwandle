"""
Application Configuration
Loads settings from environment variables
"""

from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "Ulwandle Tech - RAC"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "change-this-in-production"

    # API Configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]

    # Database
    DATABASE_URL: str = "postgresql://ulwandle:ulwandle_password@localhost:5432/ulwandle_db"

    # Claude AI
    ANTHROPIC_API_KEY: str = ""

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Water Quality Thresholds (SANS 241)
    PH_MIN: float = 6.0
    PH_MAX: float = 9.5
    TDS_MAX: float = 1200.0  # mg/L
    TURBIDITY_MAX: float = 5.0  # NTU

    # Leak Detection
    LEAK_THRESHOLD_PERCENT: float = 15.0
    ANOMALY_DETECTION_SENSITIVITY: float = 0.85

    # Kill Switch
    VALVE_CONTROL_ENABLED: bool = True
    VALVE_TIMEOUT_SECONDS: int = 30
    REQUIRE_MANUAL_CONFIRMATION: bool = True

    # Notifications
    ALERT_EMAIL: str = "alerts@ulwandle.tech"
    SMS_API_KEY: str = ""
    SMS_API_URL: str = "https://api.sms-provider.co.za/send"
    NOTIFICATION_WEBHOOK_URL: str = ""
    EMPLOYEE_NOTIFICATION_ENABLED: bool = True

    # Monitoring
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "/var/log/ulwandle/app.log"

    class Config:
        env_file = ".env"
        case_sensitive = True


# Initialize settings
settings = Settings()
