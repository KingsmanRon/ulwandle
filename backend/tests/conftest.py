"""
Pytest configuration. Sets the env vars `Settings` needs to construct itself
before any `app.*` module is imported, and points DATABASE_URL at a SQLite
file the integration tests can create_all into.
"""

import os
import tempfile


# A single SQLite file used by every test that touches the DB. We use a file
# (not :memory:) so that multiple connections — including the FastAPI app's
# request-scoped sessions — see the same data.
_DB_FILE = os.environ.get("ULWANDLE_TEST_DB") or tempfile.mktemp(suffix="-ulwandle.sqlite")
os.environ["ULWANDLE_TEST_DB"] = _DB_FILE

os.environ.setdefault("SECRET_KEY", "ci-test-secret-key-must-be-at-least-32-chars")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_DB_FILE}")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DEBUG", "false")
# Metrics middleware is on by default; integration tests rely on /metrics.
os.environ.setdefault("ENABLE_METRICS", "true")
