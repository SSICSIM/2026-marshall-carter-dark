"""period_directives_net_worth

Files directives and net worth transactions under a crisis period, the same
way crisis notes are, so running a crisis update (archiving the period)
moves them into the archive. Existing rows are backfilled to the active
period.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-12 12:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ("delegate_notes", "net_worth_transactions")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table,
            sa.Column(
                "period_id",
                sa.Integer(),
                sa.ForeignKey("crisis_periods.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index(f"ix_{table}_period_id", table, ["period_id"])
        op.execute(
            f"UPDATE {table} SET period_id = "
            "(SELECT id FROM crisis_periods WHERE is_active LIMIT 1)"
        )


def downgrade() -> None:
    for table in TABLES:
        op.drop_index(f"ix_{table}_period_id", table_name=table)
        op.drop_column(table, "period_id")
