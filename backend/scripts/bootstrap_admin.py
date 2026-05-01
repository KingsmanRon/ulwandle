"""
Bootstrap CLI to create the first admin user.

Usage:
    python -m scripts.bootstrap_admin --email admin@ulwandle.tech --name "Admin"

The password is read from stdin so it doesn't appear in process listings.
"""

import argparse
import getpass
import sys

from app.auth.security import hash_password
from app.db.database import SessionLocal
from app.models.models import User, UserRole


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--role", default="admin",
                        choices=[r.value for r in UserRole])
    args = parser.parse_args()

    pw = getpass.getpass("Password (>=12 chars): ")
    if len(pw) < 12:
        print("Password too short", file=sys.stderr)
        return 2
    confirm = getpass.getpass("Confirm: ")
    if pw != confirm:
        print("Mismatch", file=sys.stderr)
        return 2

    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == args.email.lower()).first():
            print("User already exists", file=sys.stderr)
            return 1
        user = User(
            email=args.email.lower(),
            full_name=args.name,
            hashed_password=hash_password(pw),
            role=UserRole(args.role),
        )
        db.add(user)
        db.commit()
        print(f"Created {user.email} (role={user.role.value}, id={user.id})")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
