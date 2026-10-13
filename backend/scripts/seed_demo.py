"""Seed a pretend committee session for demos and local development.

Seeds the characters (see seed_characters), then plays out a few crisis
updates of net worth changes themed on the committee's 1882 setting —
opening balances, edits, transfers, a bulk directive and random
fluctuations — each justified by a crisis note, plus seals and
private/public directives. Timestamps are spread over the past
few hours so the net worth charts have shape.

Goes through the API's own handlers, so every rule (locking, required crisis
notes, skip-fluctuation flags) applies exactly as it does in the app.

Skips everything after the characters if any net worth history already
exists. Usage, from backend/:

    python -m scripts.seed_demo
    # or inside docker compose:
    docker compose exec backend python -m scripts.seed_demo
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from app.api.crisis_periods import archive_period, create_period
from app.api.delegate_notes import create_delegate_note
from app.api.net_worth import create_transaction
from app.api.seals import issue_seals, spend, transfer_seals
from app.database import SessionLocal
from app.models.crisis_note import Character, CrisisNote, CrisisPeriod, NoteType, Priority
from app.models.mechanics import (
    DelegateNoteType,
    NetWorthTransaction,
    SealMovement,
    TransactionKind,
)
from app.schemas import (
    CrisisNoteCreate,
    CrisisPeriodCreate,
    DelegateNoteCreate,
    NetWorthChange,
    NetWorthTransactionCreate,
    SealGrant,
    SealIssue,
    SealSpend,
    SealTransfer,
)
from scripts import seed_characters

STEP = timedelta(minutes=12)


def main() -> None:
    seed_characters.main()
    # Fixed seed so the crisis-update fluctuations are the same every run.
    random.seed(1920)

    db = SessionLocal()
    try:
        if db.query(NetWorthTransaction).first():
            print("Net worth history already exists — skipping demo data.")
            return

        ids = {c.name: c.id for c in db.query(Character).all()}
        NT = ids["Nuthanan Tharmarajah"]
        EW = ids["Elizabeth Wright"]
        EC = ids["Ethan Currie"]
        EY = ids["Elisha Yao"]

        if not db.query(CrisisPeriod).filter(CrisisPeriod.is_active.is_(True)).first():
            create_period(CrisisPeriodCreate(name="Update 0"), db)

        clock = datetime.now(timezone.utc) - STEP * 16

        def backdate(txn_id: int) -> None:
            """Move a transaction (and a note it created) back to the next tick."""
            nonlocal clock
            clock += STEP
            txn = db.get(NetWorthTransaction, txn_id)
            txn.created_at = clock
            if txn.crisis_note and txn.crisis_note.created_at > clock:
                txn.crisis_note.created_at = clock
            db.commit()

        def change(
            changes: dict[int, int],
            note: tuple[str, str, int, NoteType, Priority] | int,
            kind: TransactionKind = TransactionKind.ADJUSTMENT,
            description: str | None = None,
        ) -> int:
            """Record a money change. ``note`` is either (title, description,
            filed-under character, type, priority) for a new crisis note, or
            an existing crisis note id."""
            if isinstance(note, int):
                note_fields: dict = {"crisis_note_id": note}
            else:
                title, text, character_id, note_type, priority = note
                note_fields = {
                    "crisis_note": CrisisNoteCreate(
                        character_id=character_id,
                        title=title,
                        description=text,
                        priority=priority,
                        note_type=note_type,
                    )
                }
            txn = create_transaction(
                NetWorthTransactionCreate(
                    kind=kind,
                    description=description,
                    changes=[NetWorthChange(character_id=c, delta=d) for c, d in changes.items()],
                    **note_fields,
                ),
                db,
            )
            backdate(txn.id)
            return txn.id

        def crisis_update() -> None:
            """Archive the active period, which applies the market movement."""
            active = db.query(CrisisPeriod).filter(CrisisPeriod.is_active.is_(True)).one()
            archive_period(active.id, db)
            backdate(
                db.query(NetWorthTransaction)
                .filter(NetWorthTransaction.kind == TransactionKind.FLUCTUATION)
                .order_by(NetWorthTransaction.id.desc())
                .first()
                .id
            )

        PRIVATE, PUBLIC = NoteType.PRIVATE_DIRECTIVE, NoteType.PUBLIC_DIRECTIVE
        LOW, MEDIUM, HIGH = Priority.LOW, Priority.MEDIUM, Priority.HIGH

        # Events are drawn from the 1882 background guide: the Gilded Age
        # trusts, the Belle Époque, MC&D's contracts and artifacts, and the
        # Waning (magic dying, artifacts misfiring).

        # ── Opening balances (Update 0), then the first market movement ──
        change(
            {NT: 1_250_000, EW: 980_000, EC: 760_000, EY: 1_100_000},
            ("Opening balances", "Holdings on file at the London office, as of the session's opening.", NT, PRIVATE, LOW),
        )
        crisis_update()

        # ── Update 1 ──
        change(
            {EW: 120_000},
            ("Standard Oil trust certificates", "Wright buys into the newly formed Standard Oil trust before the papers catch on.", EW, PRIVATE, MEDIUM),
        )
        senator = change(
            {NT: -75_000, EC: 75_000},
            ("Buys a senator's vote", "Tharmarajah pays Currie to deliver a Congressional vote on a railroad land grant.", NT, PRIVATE, HIGH),
            kind=TransactionKind.TRANSFER,
        )
        crisis_update()

        # ── Update 2 ──
        opera = change(
            {EY: -60_000, EC: -40_000},
            ("Paris opera house", "Yao and Currie jointly fund a gilded opera house for the Belle Époque's new money.", EY, PUBLIC, MEDIUM),
        )
        opera_note = db.get(NetWorthTransaction, opera).crisis_note_id
        change(
            {EC: -50_000, EW: 45_000},
            ("Loan against an artifact", "Currie lends Wright capital, secured on a bound artifact; the firm's broker takes a cut.", EC, PRIVATE, LOW),
            kind=TransactionKind.TRANSFER,
        )
        # A second payment against the same directive reuses its crisis note.
        change({EY: -25_000}, opera_note, description="Paris opera house – second instalment")
        crisis_update()

        # ── Update 3 ──
        change(
            {NT: -110_000},
            ("Artifact misfires — the Waning", "Tharmarajah's bound ledger, which foretold market prices, has gone silent. Positions taken on its word collapse.", NT, PRIVATE, HIGH),
        )
        change(
            {NT: 210_000},
            ("Pittsburgh steel contract", "Tharmarajah brokers a contract with a steel magnate in exchange for a cut of his works.", NT, PRIVATE, MEDIUM),
        )
        crisis_update()

        # ── Update 4 (current) ──
        change(
            {EY: 35_000},
            ("South Sea Bubble repayment", "Another instalment from Mr. Dark's 1720 position, owed to the firm for two hundred years, lands with Yao.", EY, PRIVATE, LOW),
        )
        change(
            {EW: -20_000, NT: 20_000},
            ("Settles a wager on the Waning", "Wright bet the decline was sabotage and lost when Tharmarajah's evidence held up.", EW, PRIVATE, MEDIUM),
            kind=TransactionKind.TRANSFER,
        )

        # ── Wax seals (per the mechanics guide) ──
        # Uneven starting allotments, a trade, seals spent on a crisis note and
        # on a joint directive, and a reward from the crisis team.
        issue_seals(
            SealIssue(
                grants=[
                    SealGrant(character_id=NT, quantity=4),
                    SealGrant(character_id=EW, quantity=3),
                    SealGrant(character_id=EC, quantity=2),
                    SealGrant(character_id=EY, quantity=5),
                ],
                reason="Starting allotment",
            ),
            db,
        )
        transfer_seals(
            SealTransfer(
                from_character_id=EY, to_character_id=EC, quantity=1,
                reason="Pledged in exchange for Currie's support on the opera house",
            ),
            db,
        )
        spend(
            SealSpend(
                character_id=NT, quantity=2,
                crisis_note_id=db.get(NetWorthTransaction, senator).crisis_note_id,
            ),
            db,
        )

        # ── Directives (one per debate topic, plus some intrigue) ──
        for title, note_type, who, contents, seals in [
            ("Investigates the Waning", DelegateNoteType.PRIVATE_DIRECTIVE, [NT],
             "Asks the archives for every failed artifact this decade. Suspects sabotage over scientific corrosion.",
             []),
            # A joint directive, sealed by both delegates involved.
            ("Petition for a partnership seat", DelegateNoteType.PRIVATE_DIRECTIVE, [EY, EC],
             "Yao and Currie jointly petition Mr. Dark to seat senior personnel at the highest table.",
             [SealGrant(character_id=EY, quantity=2), SealGrant(character_id=EC, quantity=1)]),
            ("List the firm on the exchange", DelegateNoteType.PUBLIC_DIRECTIVE, [EW],
             "Proposes incorporating MC&D and listing it on the New York exchange the Fifth Marshall co-founded.",
             []),
            ("Whispers about Mara Dark", DelegateNoteType.PRIVATE_DIRECTIVE, [EW, EC],
             "Wright hints to Currie that she knows why Mr. Dark adopted an heir now. Watch for leverage.",
             [SealGrant(character_id=EW, quantity=1)]),
        ]:
            create_delegate_note(
                DelegateNoteCreate(
                    title=title, note_type=note_type, character_ids=who, contents=contents, seals=seals
                ),
                db,
            )
        issue_seals(
            SealIssue(
                grants=[SealGrant(character_id=EW, quantity=1)],
                reason="Crisis team reward: a well-argued directive",
            ),
            db,
        )

        # Spread the seal log across the session like the money changes.
        movements = db.query(SealMovement).order_by(SealMovement.id).all()
        start = datetime.now(timezone.utc) - STEP * 15
        for i, movement in enumerate(movements):
            movement.created_at = start + (STEP * 14) * i / max(len(movements) - 1, 1)
        db.commit()

        notes = db.query(CrisisNote).count()
        txns = db.query(NetWorthTransaction).count()
        print(f"Seeded {txns} net worth changes, {notes} crisis notes, seals and directives.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
