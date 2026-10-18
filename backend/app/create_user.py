"""Creates an account, or sets a new password for an existing one.

    python -m app.create_user you@example.edu --name "Your Name"

You're asked for the password, so it never appears in your shell history.
"""

import argparse
import getpass
import sys

from . import models as m
from .auth import find_user, hash_password
from .db import SessionLocal
from .services.actions import EMAIL, new_id

MIN_LENGTH = 10


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("email")
    parser.add_argument("--name", help="Full name (required for a new account)")
    parser.add_argument("--role", choices=["admin", "participant"], default="admin")
    args = parser.parse_args()

    email = args.email.strip()
    if not EMAIL.match(email):
        sys.exit("That doesn't look like an email address.")
    password = getpass.getpass("Password: ")
    if len(password) < MIN_LENGTH:
        sys.exit(f"Use at least {MIN_LENGTH} characters.")
    if getpass.getpass("Same password again: ") != password:
        sys.exit("The passwords don't match.")

    with SessionLocal() as session:
        user = find_user(session, email)
        if user is None:
            if not args.name:
                sys.exit("New account: add --name \"Your Name\".")
            user = m.User(id=new_id("user"), name=args.name.strip(), email=email, role=args.role)
            session.add(user)
            action = "Created"
        else:
            action = "Updated the password for"
            if args.name:
                user.name = args.name.strip()
            user.role = args.role
        user.password_hash = hash_password(password)
        session.commit()
    print(f"{action} {email} ({args.role}).")


if __name__ == "__main__":
    main()
