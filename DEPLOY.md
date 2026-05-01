# Deployment guide (free-tier first)

The system is designed so that the first deployment can run entirely on
free tiers, then migrate to paid plans without code changes.

## Recommended free-tier stack
| Component  | Service       | Free tier note                           |
| ---------- | ------------- | ----------------------------------------- |
| Backend    | Fly.io        | 3 shared-cpu-1x machines, 256 MB RAM      |
| Postgres   | Neon          | 0.5 GB storage, branching, autosuspend    |
| Redis      | Upstash       | 10 k commands/day                         |
| Frontend   | Vercel        | 100 GB bandwidth/month                    |
| CI         | GitHub Actions| 2,000 min/month                           |

> Neon does **not** ship TimescaleDB. The current schema runs fine on
> stock Postgres with the indexes shipped in `0001_initial.py`. Move to
> Timescale Cloud / managed Postgres + Timescale extension when you
> outgrow it; convert `flow_readings`, `pressure_readings`, and
> `water_quality_readings` to hypertables in a follow-up migration.

## One-time bootstrap
1. **Generate secrets**

   ```sh
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

2. **Provision Neon** and capture `DATABASE_URL`. Add `?sslmode=require`.
3. **Provision Upstash Redis** and capture `REDIS_URL` (TLS).
4. **Get an Anthropic API key**.

## Deploy backend (Fly.io)
```sh
brew install flyctl                     # or curl -L https://fly.io/install.sh | sh
flyctl auth login

cd /path/to/repo
flyctl launch --no-deploy --copy-config --config deploy/fly.toml --name ulwandle-rac
flyctl secrets set \
    SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')" \
    DATABASE_URL="postgres://...neon..." \
    REDIS_URL="rediss://...upstash..." \
    ANTHROPIC_API_KEY="sk-ant-..." \
    CORS_ORIGINS="https://ulwandle-rac.vercel.app" \
    TRUSTED_HOSTS="ulwandle-rac.fly.dev"
flyctl deploy --config deploy/fly.toml
```

The release command `alembic upgrade head` runs migrations before the
first instance starts.

## Bootstrap the first admin
```sh
flyctl ssh console --config deploy/fly.toml
python -m scripts.bootstrap_admin --email you@example.com --name "Admin"
# enter password at prompt
```

## Deploy frontend (Vercel)
```sh
cd frontend
vercel --prod \
    --build-env REACT_APP_API_URL=https://ulwandle-rac.fly.dev
```

After the first deploy, set the Vercel project's `REACT_APP_API_URL`
environment variable so subsequent builds pick it up automatically.

## Enable the kill switch
Once you've smoke-tested everything end-to-end:

```sh
flyctl secrets set VALVE_CONTROL_ENABLED=true --config deploy/fly.toml
```

## Local development
```sh
cp .env.example .env  # then edit
docker compose up --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m scripts.bootstrap_admin --email dev@local --name "Dev Admin"
```

The compose stack binds the API and frontend to `127.0.0.1` only — put
them behind a reverse proxy (Caddy, Traefik, nginx) for any outside
exposure.

## Sensor onboarding
```sh
# As an admin, POST /api/v1/monitoring/sensors. The response includes
# `ingest_secret` ONCE — store it on the gateway.
# Each reading must send:
#   X-Sensor-Secret: <plaintext secret>
#   X-Timestamp:     <ISO-8601 UTC>
#   X-Signature:     hex(HMAC-SHA256(secret, timestamp + "." + body))
```

## Observability
- `GET /health` for liveness checks.
- Structured stdout logs; ship to Logtail / Better Stack / Grafana Loki.
- Audit trail lives in the `audit_logs` table; export periodically.
