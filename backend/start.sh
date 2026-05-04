#!/bin/sh
set -eu

alembic upgrade head

# Idempotent seed of metros / dams / data sources. Upserts on PK so
# safe to run on every container start. Non-fatal if it fails (a
# transient DB blip should not prevent the API from booting); the
# next start will retry.
python -m scripts.seed_metros || echo "seed_metros: skipped or failed (non-fatal)"

exec gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers 2 \
    --bind 0.0.0.0:8000 \
    --timeout 60 \
    --graceful-timeout 30 \
    --access-logfile - \
    --error-logfile -
