"""
One-off admin create/reset — runs from a laptop against the *production* Neon DB
when Render Shell isn't available (free tier).

Self-contained: talks to the `users` table via SQLAlchemy core, so it does NOT
import the app or need the full requirements — only sqlalchemy, psycopg2-binary,
argon2-cffi. The Argon2id params match app/auth/security.py, and since Argon2
hashes are self-describing, the resulting row verifies under the live backend.

Reads everything from environment variables so no secret is passed on the CLI:
    DATABASE_URL    Neon connection string (copy from Render -> Environment)
    ADMIN_EMAIL     login email
    ADMIN_PASSWORD  new password (>= 12 chars)
    ADMIN_NAME      optional display name (default "Admin")

It UPSERTS: resets the password (and clears any lock / reactivates) if the email
already exists, otherwise creates a new admin.
"""

import os
import sys

from argon2 import PasswordHasher
from sqlalchemy import create_engine, text


def main() -> int:
    db_url = os.environ.get("DATABASE_URL", "").strip()
    email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD", "")
    name = os.environ.get("ADMIN_NAME", "Admin").strip() or "Admin"

    if not db_url or not email or not password:
        print("Set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD env vars first.",
              file=sys.stderr)
        return 2
    if "@neon" not in db_url and "neon.tech" not in db_url and "render.com" not in db_url:
        # Soft guard so you don't accidentally run this against local docker.
        print(f"WARNING: DATABASE_URL host doesn't look like Neon: "
              f"{db_url.split('@')[-1][:40]}...", file=sys.stderr)
    if len(password) < 12:
        print("ADMIN_PASSWORD must be at least 12 characters.", file=sys.stderr)
        return 2

    # SQLAlchemy 2.x wants the 'postgresql://' scheme, not the legacy 'postgres://'.
    if db_url.startswith("postgres://"):
        db_url = "postgresql://" + db_url[len("postgres://"):]

    hasher = PasswordHasher(time_cost=3, memory_cost=64 * 1024,
                            parallelism=2, hash_len=32, salt_len=16)
    hashed = hasher.hash(password)

    engine = create_engine(db_url, future=True)
    with engine.begin() as conn:
        total = conn.execute(text("SELECT count(*) FROM users")).scalar()
        print(f"total users in this DB: {total}")
        row = conn.execute(
            text("SELECT id, role FROM users WHERE email = :e"), {"e": email}
        ).first()
        if row:
            conn.execute(text(
                "UPDATE users SET hashed_password = :h, is_active = true, "
                "failed_login_attempts = 0, locked_until = NULL WHERE email = :e"
            ), {"h": hashed, "e": email})
            print(f"RESET password for existing user id={row[0]} role={row[1]} email={email}")
        else:
            conn.execute(text(
                "INSERT INTO users (email, full_name, hashed_password, role, "
                "is_active, failed_login_attempts) "
                "VALUES (:e, :n, :h, 'admin', true, 0)"
            ), {"e": email, "n": name, "h": hashed})
            print(f"CREATED admin email={email} role=admin")
    print("Done. Log in at the frontend with that email + password.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
