"""Seed the committee's characters (delegates).

Idempotent: characters that already exist (by name) are left alone, so it's
safe to re-run. Usage, from backend/:

    python -m scripts.seed_characters
    # or inside docker compose:
    docker compose exec backend python -m scripts.seed_characters
"""
from __future__ import annotations

from app.database import SessionLocal
from app.models.crisis_note import Character

CHARACTERS = [
    "Nuthanan Tharmarajah",
    "Elizabeth Wright",
    "Ethan Currie",
    "Elisha Yao",
]


def main() -> None:
    db = SessionLocal()
    try:
        existing = {name for (name,) in db.query(Character.name).all()}
        added = [name for name in CHARACTERS if name not in existing]
        db.add_all(Character(name=name) for name in added)
        db.commit()
    finally:
        db.close()
    print(f"Added {len(added)} character(s): {', '.join(added) or 'none (already seeded)'}")


if __name__ == "__main__":
    main()
