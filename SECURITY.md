# Security model

## Identity & access
- **AuthN:** OAuth2 password flow → JWT access tokens (HS256, 15 min) and
  rotating refresh tokens (7 day, server-revocable). Passwords hashed with
  Argon2id (`argon2-cffi`). 10 failed logins → 15 min account lock.
- **AuthZ:** RBAC with roles `admin`, `supervisor`, `operator`, `viewer`.
  Every endpoint declares an explicit role gate; no implicit access.

## Cryptographic authorization for valve operations
- Each operator generates an Ed25519 keypair in the browser. Only the
  public key is registered with the server. The private key is encrypted
  with AES-GCM derived from a passphrase via PBKDF2 (310k iters) and
  stored in `localStorage`.
- Every valve operation is signed twice:
  1. **Proposer** signs `v1|propose|<valve_id>|<action>|<nonce>|<issued_at>`
  2. **Approver** (different user) signs the same bytes with role
     `approve`, plus the proposer's user id, to prevent signature reuse
     across proposals.
- Single-use nonces are persisted to `used_nonces`; a 5-minute issued-at
  skew window is enforced to bound replay surfaces.
- Proposals expire after `PROPOSAL_TTL_SECONDS` (default 10 min).
- The Claude advisory output is **never** consulted to authorize execution.

## Sensor ingestion
- Each sensor receives a one-time `ingest_secret` at provisioning time
  (server stores Argon2 hash). Readings must include
  `X-Sensor-Secret`, `X-Timestamp`, and `X-Signature` headers, where
  `X-Signature = HMAC_SHA256(ingest_secret, timestamp || "." || body)`.
  Skew window: 120 s.

## Network / transport
- Strict CORS allowlist (no wildcards); methods limited; headers limited.
- HSTS, X-Content-Type-Options, X-Frame-Options=DENY, Referrer-Policy
  set on every API and static response.
- 1 MB request body cap by default. Per-route slowapi rate limits.
- Authenticated WebSocket via short-lived access JWT in `?token=`. The
  server does not echo client input; channels are server-initiated.

## Data
- Audit log (`audit_logs`) appends actor, action, resource, IP-hash,
  payload for every state-changing operation. Admin/supervisor users can
  read and CSV-export the trail via `GET /api/v1/audit-logs[/export.csv]`.
- Refresh tokens are rotated on every refresh and revoked on logout.
  `POST /api/v1/auth/logout-all` revokes every refresh token belonging to
  the current user — use it when a token may be compromised.
- IPs are stored only as a salted SHA-256 hash.

## Observability
- `/metrics` exposes Prometheus counters for HTTP requests, scraper runs,
  alert creations, and valve operations. Route templates (not raw paths)
  are used as labels to cap cardinality.
- Scraper failures raise an `alert_type=scraper` row with a 6-hour
  dedup window and fan out to the configured notification channels.

## Notification dispatch
- Alerts at or above `NOTIFICATION_MIN_LEVEL` (default `warning`) are
  dispatched out-of-band via SMTP (`SMTP_HOST` / `SMTP_PORT` / …) and an
  optional webhook (`NOTIFICATION_WEBHOOK_URL`). Dispatch never raises
  back into the request lifecycle.

## Config posture
- `SECRET_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY` are required —
  the app refuses to start without them.
- `VALVE_CONTROL_ENABLED=false` by default. `DEBUG` must be false outside
  development. CORS origins are required in non-dev environments.

## Supply chain
- `pip-audit` and `gitleaks` run in CI. Pinned dependency versions.
- Removed: `python-jose`, `passlib`, `aiohttp`, `aioredis`, `celery`,
  `pandas`, `numpy`, `scikit-learn` (unused or unsafe).

## Reporting issues
Please file private security issues to security@ulwandle.tech (or the
contact listed in your fork). Do not open public GitHub issues for
vulnerabilities.
