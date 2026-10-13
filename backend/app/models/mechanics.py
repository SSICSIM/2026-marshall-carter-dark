from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.crisis_note import Character, CrisisNote, CrisisPeriod


class TransactionKind(str, enum.Enum):
    # Manual add/subtract on one or more delegates (bulk = more than one entry).
    ADJUSTMENT = "ADJUSTMENT"
    # Money moved between delegates; amounts per side don't have to mirror.
    TRANSFER = "TRANSFER"
    # Random market movement applied at a crisis update.
    FLUCTUATION = "FLUCTUATION"


class SealAction(str, enum.Enum):
    # Staff hand seals to a delegate: starting allotment or a crisis-team reward.
    ISSUED = "ISSUED"
    # A delegate gives/trades/pledges seals to another delegate.
    TRANSFERRED = "TRANSFERRED"
    # Seals attached to a crisis note or directive; sent to the crisis room, gone.
    SPENT = "SPENT"
    # Staff take seals back (corrections).
    REVOKED = "REVOKED"


class DelegateNoteType(str, enum.Enum):
    PRIVATE_DIRECTIVE = "PRIVATE_DIRECTIVE"
    PUBLIC_DIRECTIVE = "PUBLIC_DIRECTIVE"


class NetWorthTransaction(Base):
    __tablename__ = "net_worth_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[TransactionKind] = mapped_column(
        SAEnum(TransactionKind, name="transaction_kind_enum"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # The crisis note that justifies a manual change (required by the API for
    # adjustments and transfers; fluctuations have none). SET NULL keeps the
    # ledger intact if staff later delete the note.
    crisis_note_id: Mapped[int | None] = mapped_column(
        ForeignKey("crisis_notes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # The crisis update (period) the change happened in. A crisis update's
    # own market movement opens the next period, so it's filed there.
    period_id: Mapped[int | None] = mapped_column(
        ForeignKey("crisis_periods.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    crisis_note: Mapped[CrisisNote | None] = relationship("CrisisNote")
    period: Mapped[CrisisPeriod | None] = relationship("CrisisPeriod")
    entries: Mapped[list[NetWorthEntry]] = relationship(
        "NetWorthEntry",
        back_populates="transaction",
        cascade="all, delete-orphan",
        order_by="NetWorthEntry.id",
    )


class NetWorthEntry(Base):
    """One delegate's share of a transaction. ``balance_after`` is the
    delegate's net worth once this entry was applied, which is what the
    per-delegate history chart plots."""

    __tablename__ = "net_worth_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("net_worth_transactions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[int] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    delta: Mapped[int] = mapped_column(BigInteger, nullable=False)
    balance_after: Mapped[int] = mapped_column(BigInteger, nullable=False)

    transaction: Mapped[NetWorthTransaction] = relationship(
        "NetWorthTransaction", back_populates="entries"
    )
    character: Mapped[Character] = relationship("Character")


class SealMovement(Base):
    """One line of the wax seal ledger. Balances live on
    ``Character.seal_count``; this is the history of how they got there.

    ``from_character`` is who loses seals (null when staff issue them),
    ``to_character`` who gains them (null when spent or revoked). A spend is
    linked to the crisis note or directive the seals were attached to."""

    __tablename__ = "seal_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[SealAction] = mapped_column(
        SAEnum(SealAction, name="seal_action_enum"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    from_character_id: Mapped[int | None] = mapped_column(
        ForeignKey("characters.id", ondelete="SET NULL"), nullable=True, index=True
    )
    to_character_id: Mapped[int | None] = mapped_column(
        ForeignKey("characters.id", ondelete="SET NULL"), nullable=True, index=True
    )
    crisis_note_id: Mapped[int | None] = mapped_column(
        ForeignKey("crisis_notes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    directive_id: Mapped[int | None] = mapped_column(
        ForeignKey("delegate_notes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    from_character: Mapped[Character | None] = relationship(
        "Character", foreign_keys=[from_character_id]
    )
    to_character: Mapped[Character | None] = relationship(
        "Character", foreign_keys=[to_character_id]
    )
    crisis_note: Mapped[CrisisNote | None] = relationship("CrisisNote")
    directive: Mapped[DelegateNote | None] = relationship("DelegateNote")


delegate_note_characters = Table(
    "delegate_note_characters",
    Base.metadata,
    Column(
        "note_id",
        ForeignKey("delegate_notes.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "character_id",
        ForeignKey("characters.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class DelegateNote(Base):
    """A private or public directive. Directives can list several
    delegates, so delegates are many-to-many rather than a single
    foreign key."""

    __tablename__ = "delegate_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    note_type: Mapped[DelegateNoteType] = mapped_column(
        SAEnum(DelegateNoteType, name="delegate_note_type_enum"), nullable=False
    )
    contents: Mapped[str] = mapped_column(Text, nullable=False)
    # Filed in the active period like crisis notes, so running a crisis
    # update moves it to the archive.
    period_id: Mapped[int | None] = mapped_column(
        ForeignKey("crisis_periods.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    characters: Mapped[list[Character]] = relationship(
        "Character", secondary=delegate_note_characters, order_by="Character.name"
    )
    period: Mapped[CrisisPeriod | None] = relationship("CrisisPeriod")
