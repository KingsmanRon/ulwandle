# Deployment guide — Vercel (frontend) + Render (backend)

The system runs on free tiers for the pilot. Architecture:

```
  Vercel (frontend, static)  ───►  Render (FastAPI backend, Docker)
                                       │
                              ┌────────┼────────┐
                              ▼        ▼        ▼
                            Neon    Upstash   Anthropic
                          (Postgres) (Redis)   (Claude)
```

## Accounts to create

| Service | Purpose | Free tier |
|---|---|---|
| GitHub | Source + CI | ✅ |
| Vercel | Frontend hosting | ✅ Hobby |
| Render | Backend hosting | ✅ (spins down after 15 min idle) |
| Neon | Postgres | ✅ 0.5 GB |
| Upstash | Redis | ✅ 10k cmd/day |
| Anthropic Console | Claude API key | Pay-as-you-go (~$5 signup credit) |

---

## Step 1 — Provision the data layer (5 min)

### 1a. Neon (Postgres)

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project (region: any EU region; Frankfurt matches Render)
3. Copy the connection string — must look like:
   ```
   postgresql://USER:PASS@ep-xxx-pooler.eu-central-1.aws.neon.tech/DBNAME?sslmode=require
   ```
   The `?sslmode=require` suffix is critical.

### 1b. Upstash (Redis)

1. Sign up at [upstash.com](https://upstash.com)
2. Create a Redis database (region: matching EU region)
3. Copy the **TLS URL** — must start with `rediss://` (two s's), not `redis://`

### 1c. Anthropic

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Add billing or claim signup credit
3. Generate an API key — starts with `sk-ant-api03-`

### 1d. Generate SECRET_KEY

Run locally:
```sh
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```
Save the output — you'll paste it into Render in a minute.

---

## Step 2 — Deploy the backend on Render (10 min)

### Via Blueprint (recommended)

1. Render Dashboard → **New + → Blueprint**
2. Connect GitHub → select repo `KingsmanRon/ulwandle`
3. Branch: **`claude/add-claude-api-ulwandle-01D452VrTid1RnXu4Mso9LfK`**
4. Render auto-detects `render.yaml` at the repo root
5. Render prompts for the six secrets — fill them in:

| Secret | Value |
|---|---|
| `SECRET_KEY` | The random string from Step 1d |
| `DATABASE_URL` | Neon connection string from Step 1a |
| `ANTHROPIC_API_KEY` | From Step 1c |
| `REDIS_URL` | Upstash `rediss://...` from Step 1b |
| `CORS_ORIGINS` | `https://ulwandle.vercel.app` (predict your Vercel URL — see Step 3) |
| `TRUSTED_HOSTS` | `ulwandle-backend.onrender.com` (predict your Render URL) |

6. Click **Apply**
7. Watch the build log — first build takes ~5 min (Docker image)
8. Database migrations (`alembic upgrade head`) run automatically on every container start, before gunicorn binds. If a migration fails the container exits — check the Render logs.
9. Once green, verify:
   ```sh
   curl https://ulwandle-backend.onrender.com/health
   # expect: {"status":"ok","version":"1.2.0","revision":"<git-sha>"}
   ```

### Bootstrap the first admin

In Render Dashboard → your service → **Shell** tab:
```sh
python -m scripts.bootstrap_admin --email you@example.com --name "Admin"
```
Enter a password (≥12 characters) twice.

---

## Step 3 — Deploy the frontend on Vercel (5 min)

1. Vercel Dashboard → **Add New → Project**
2. Import `KingsmanRon/ulwandle` from GitHub
3. **Branch:** `claude/add-claude-api-ulwandle-01D452VrTid1RnXu4Mso9LfK`
4. **Configure these settings explicitly** — do not accept "Services" auto-detection:

| Field | Value |
|---|---|
| Project Name | `ulwandle` |
| Application Preset | **Create React App** |
| Root Directory | **`frontend`** *(click Edit and pick the folder)* |
| Build Command | `npm run build` *(default)* |
| Output Directory | `build` *(default)* |
| Install Command | `npm install` *(default)* |

5. **Environment Variables** — add one:

| Name | Value |
|---|---|
| `REACT_APP_API_URL` | `https://ulwandle-backend.onrender.com` *(your real Render URL)* |
| `REACT_APP_ENABLE_OPERATIONS` | Leave unset for the sourced-data production demo; set to `true` only in an operational preview environment |

Apply to all three: Production, Preview, Development.

6. Click **Deploy**
7. Once green, note the URL (e.g. `https://ulwandle.vercel.app`)

### Reconcile CORS

If the Vercel URL doesn't exactly match what you put in `CORS_ORIGINS` on Render:
1. Render Dashboard → your service → **Environment**
2. Edit `CORS_ORIGINS` to the actual Vercel URL → Save (auto-redeploys)

---

## Step 4 — End-to-end smoke test

Open `https://ulwandle.vercel.app`:

- [ ] Login page loads, no console errors
- [ ] Login as the bootstrapped admin works
- [ ] DevTools → Network shows requests going to `*.onrender.com`
- [ ] No CORS errors

Set up the security flow:

- [ ] **Settings → Signing Key** — generate (passphrase ≥ 12 chars)
- [ ] As admin, `POST /api/v1/auth/users` with role `supervisor` to create a second user
- [ ] Log in as the supervisor, register their signing key
- [ ] As admin, create a District + Valve via the API
- [ ] **As an operator**, propose a valve operation → succeeds, appears in pending list
- [ ] **As the supervisor**, approve → valve state changes; audit record contains both signatures
- [ ] Try approving with the same user that proposed → **must be rejected**
- [ ] Only **after** all of the above passes:
   ```
   Render → Environment → VALVE_CONTROL_ENABLED = true
   ```

---

## Local development

```sh
cp .env.example .env  # fill in real values
docker compose up --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m scripts.bootstrap_admin \
    --email dev@local --name "Dev Admin"
```

The compose stack binds API and frontend to `127.0.0.1` only. Put a reverse proxy in front of them for any external exposure.

---

## Sensor onboarding (later)

```sh
# As admin, POST /api/v1/monitoring/sensors. The response includes
# `ingest_secret` ONCE — store it on the gateway.
# Each reading must send:
#   X-Sensor-Secret: <plaintext secret>
#   X-Timestamp:     <ISO-8601 UTC>
#   X-Signature:     hex(HMAC-SHA256(secret, timestamp + "." + body))
```

---

## Free-tier gotchas

| Issue | Why | Mitigation |
|---|---|---|
| **Render cold starts** (~30s) | Free plan suspends after 15 min idle | Cron-job.org ping `/health` every 10 min, or upgrade to Starter ($7/mo) |
| **Neon autosuspend** (~5s wake) | Free plan suspends after 5 min idle | Same — pinging `/health` keeps the connection warm |
| **Vercel build env vars** | Baked into bundle at build time | Always **redeploy** after changing `REACT_APP_API_URL` |
| **Neon storage cap** (0.5 GB) | Time-series data adds up | Add periodic data archival once you cross ~80% |
| **Upstash daily cap** (10k cmd) | Easy to exhaust with traffic | Monitor in Upstash dashboard; upgrade or self-host Redis |
| **TimescaleDB not on Neon free** | Needed for hypertables | Schema works without it; convert hot tables to hypertables on a managed Postgres later |

---

## Observability

- `GET /health` for liveness checks
- Stdout structured logs — ship to Logtail / Better Stack / Grafana Loki
- Audit trail in `audit_logs` table — export periodically

---

## Production checklist

Before promoting beyond pilot:

- [ ] Upgrade Render Starter plan (no cold starts)
- [ ] Upgrade Neon to a paid tier (2 GB+, no autosuspend)
- [ ] Add a custom domain on both Vercel and Render
- [ ] Configure Cloudflare or AWS WAF in front of the Render service
- [ ] Replace browser-stored signing keys with WebAuthn / hardware tokens
- [ ] Enable Render's persistent disk for log retention if you don't ship to an external sink
- [ ] Add scheduled backups for the audit log table
