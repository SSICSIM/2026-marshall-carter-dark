from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Priority(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class NoteType(str, enum.Enum):
    PRIVATE_DIRECTIVE = "PRIVATE_DIRECTIVE"
    PUBLIC_DIRECTIVE = "PUBLIC_DIRECTIVE"


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    # Whole dollars. ``baseline_net_worth`` is the value at the start of the
    # current crisis update, so "difference" is net_worth - baseline.
    net_worth: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    baseline_net_worth: Mapped[int] = mapped_column(
        BigInteger, nullable=False, server_default="0"
    )
    # Set by any manual change; the next crisis update skips this delegate's
    # random fluctuation and clears the flag.
    skip_fluctuation: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    # Wax seals currently held. Kept in step with the seal_movements ledger
    # (see app/api/seals.py) and never negative.
    seal_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    crisis_notes: Mapped[list[CrisisNote]] = relationship(
        "CrisisNote", back_populates="character", cascade="all, delete-orphan"
    )


class CrisisPeriod(Base):
    __tablename__ = "crisis_periods"
    __table_args__ = (
        # Postgres partial unique index: at most one row can have is_active
        # true at a time. Makes "only one active period" a DB-level
        # guarantee instead of a check-then-insert race in the API layer.
        Index(
            "ix_crisis_periods_one_active",
            "is_active",
            unique=True,
            postgresql_where=text("is_active"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    crisis_notes: Mapped[list[CrisisNote]] = relationship(
        "CrisisNote", back_populates="period"
    )
    staff_notes: Mapped[list[StaffNote]] = relationship(
        "StaffNote", back_populates="period"
    )


class CrisisNote(Base):
    __tablename__ = "crisis_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    character_id: Mapped[int] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    period_id: Mapped[int] = mapped_column(
        ForeignKey("crisis_periods.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    crisis_staff_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[Priority] = mapped_column(
        SAEnum(Priority, name="priority_enum"), nullable=False
    )
    note_type: Mapped[NoteType] = mapped_column(
        SAEnum(NoteType, name="note_type_enum"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    character: Mapped[Character] = relationship("Character", back_populates="crisis_notes")
    period: Mapped[CrisisPeriod] = relationship("CrisisPeriod", back_populates="crisis_notes")


class StaffNote(Base):
    __tablename__ = "staff_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    period_id: Mapped[int] = mapped_column(
        ForeignKey("crisis_periods.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    period: Mapped[CrisisPeriod] = relationship("CrisisPeriod", back_populates="staff_notes")
