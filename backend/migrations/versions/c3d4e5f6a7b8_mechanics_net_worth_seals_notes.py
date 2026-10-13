"""mechanics_net_worth_seals_notes

Adds the MC&D committee mechanics: net worth tracking (balance columns on
characters plus a transaction/entry ledger, each manual change linked to the
crisis note that justifies it), private/public directives, and wax seals
(a per-delegate balance plus a ledger of every issue, transfer, spend and
revoke).

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-10 12:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

transaction_kind_enum = sa.Enum(
    "ADJUSTMENT", "TRANSFER", "FLUCTUATION", name="transaction_kind_enum"
)
delegate_note_type_enum = sa.Enum(
    "PRIVATE_DIRECTIVE", "PUBLIC_DIRECTIVE", name="delegate_note_type_enum"
)
seal_action_enum = sa.Enum("ISSUED", "TRANSFERRED", "SPENT", "REVOKED", name="seal_action_enum")


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True
    )


def _character_fk(name: str, ondelete: str, nullable: bool) -> sa.Column:
    return sa.Column(
        name, sa.Integer(), sa.ForeignKey("characters.id", ondelete=ondelete), nullable=nullable
    )


def upgrade() -> None:
    # ── Balances on characters ──
    op.add_column(
        "characters",
        sa.Column("net_worth", sa.BigInteger(), server_default="0", nullable=False),
    )
    op.add_column(
        "characters",
        sa.Column("baseline_net_worth", sa.BigInteger(), server_default="0", nullable=False),
    )
    op.add_column(
        "characters",
        sa.Column("skip_fluctuation", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "characters",
        sa.Column("seal_count", sa.Integer(), server_default="0", nullable=False),
    )

    # ── Net worth ledger ──
    op.create_table(
        "net_worth_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kind", transaction_kind_enum, nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "crisis_note_id",
            sa.Integer(),
            sa.ForeignKey("crisis_notes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        _created_at(),
    )
    op.create_index(
        "ix_net_worth_transactions_crisis_note_id", "net_worth_transactions", ["crisis_note_id"]
    )

    op.create_table(
        "net_worth_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "transaction_id",
            sa.Integer(),
            sa.ForeignKey("net_worth_transactions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        _character_fk("character_id", "CASCADE", nullable=False),
        sa.Column("delta", sa.BigInteger(), nullable=False),
        sa.Column("balance_after", sa.BigInteger(), nullable=False),
    )
    op.create_index("ix_net_worth_entries_transaction_id", "net_worth_entries", ["transaction_id"])
    op.create_index("ix_net_worth_entries_character_id", "net_worth_entries", ["character_id"])

    # ── Directives ──
    op.create_table(
        "delegate_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("note_type", delegate_note_type_enum, nullable=False),
        sa.Column("contents", sa.Text(), nullable=False),
        _created_at(),
    )
    op.create_table(
        "delegate_note_characters",
        sa.Column(
            "note_id",
            sa.Integer(),
            sa.ForeignKey("delegate_notes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "character_id",
            sa.Integer(),
            sa.ForeignKey("characters.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    # ── Wax seal ledger ──
    op.create_table(
        "seal_movements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("action", seal_action_enum, nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        _character_fk("from_character_id", "SET NULL", nullable=True),
        _character_fk("to_character_id", "SET NULL", nullable=True),
        sa.Column(
            "crisis_note_id",
            sa.Integer(),
            sa.ForeignKey("crisis_notes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "directive_id",
            sa.Integer(),
            sa.ForeignKey("delegate_notes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reason", sa.Text(), nullable=True),
        _created_at(),
    )
    for column in ("from_character_id", "to_character_id", "crisis_note_id", "directive_id"):
        op.create_index(f"ix_seal_movements_{column}", "seal_movements", [column])


def downgrade() -> None:
    for column in ("from_character_id", "to_character_id", "crisis_note_id", "directive_id"):
        op.drop_index(f"ix_seal_movements_{column}", table_name="seal_movements")
    op.drop_table("seal_movements")
    op.drop_table("delegate_note_characters")
    op.drop_table("delegate_notes")
    op.drop_index("ix_net_worth_entries_character_id", table_name="net_worth_entries")
    op.drop_index("ix_net_worth_entries_transaction_id", table_name="net_worth_entries")
    op.drop_table("net_worth_entries")
    op.drop_index(
        "ix_net_worth_transactions_crisis_note_id", table_name="net_worth_transactions"
    )
    op.drop_table("net_worth_transactions")
    seal_action_enum.drop(op.get_bind(), checkfirst=True)
    delegate_note_type_enum.drop(op.get_bind(), checkfirst=True)
    transaction_kind_enum.drop(op.get_bind(), checkfirst=True)
    op.drop_column("characters", "seal_count")
    op.drop_column("characters", "skip_fluctuation")
    op.drop_column("characters", "baseline_net_worth")
    op.drop_column("characters", "net_worth")
