"""
Test bootstrap.

The app modules build ``Settings`` at import time (and ``create_engine`` from
DATABASE_URL), so set safe dummy values before anything under ``app`` is
imported. No real database or network is touched by these tests — the engine
connects lazily and the scraper parsers operate on in-repo fixtures.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-at-least-32-chars-long")
os.environ.setdefault("DATABASE_URL", "postgresql://u:p@127.0.0.1/db")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DEBUG", "false")
