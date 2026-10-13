from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.crisis_note import NoteType, Priority
from app.models.mechanics import DelegateNoteType, SealAction, TransactionKind


class HealthResponse(BaseModel):
    status: str = "ok"


# ── Characters ──────────────────────────────────────────────────────────────

class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class CharacterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime


# ── Crisis Periods ───────────────────────────────────────────────────────────

class CrisisPeriodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class CrisisPeriodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_active: bool
    created_at: datetime
    archived_at: datetime | None


# ── Crisis Notes ─────────────────────────────────────────────────────────────

class CrisisNoteCreate(BaseModel):
    character_id: int
    # Optional: lets the client assert which period it expects the note to
    # land in, so create_note can reject a stale submission (see there) if
    # the active period has since changed. Omit to just use whatever period
    # is currently active.
    period_id: int | None = None
    title: str = Field(min_length=1, max_length=512)
    description: str = Field(min_length=1)
    crisis_staff_notes: str | None = None
    priority: Priority
    note_type: NoteType


class CrisisNoteUpdate(BaseModel):
    character_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=512)
    description: str | None = Field(default=None, min_length=1)
    crisis_staff_notes: str | None = None
    priority: Priority | None = None
    note_type: NoteType | None = None


class CrisisNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period_id: int
    character: CharacterResponse
    title: str
    description: str
    crisis_staff_notes: str | None
    priority: Priority
    note_type: NoteType
    created_at: datetime


# ── Staff Notes ───────────────────────────────────────────────────────────────

class StaffNoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    content: str = Field(min_length=1)


class StaffNoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    content: str | None = Field(default=None, min_length=1)


class StaffNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period_id: int
    title: str
    content: str
    created_at: datetime


# ── Bulk upload ──────────────────────────────────────────────────────────────

class BulkUploadResult(BaseModel):
    created: int
    skipped: int


# ── Analytics ────────────────────────────────────────────────────────────────

class NotesByCharacter(BaseModel):
    character_name: str
    count: int


class PriorityCount(BaseModel):
    priority: Priority
    count: int


class AnalyticsSummary(BaseModel):
    total_notes: int
    notes_by_character: list[NotesByCharacter]
    priority_distribution: list[PriorityCount]
    private_directive_count: int
    public_directive_count: int


# ── Net Worth ────────────────────────────────────────────────────────────────

class DelegateNetWorth(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    net_worth: int
    baseline_net_worth: int
    skip_fluctuation: bool


class NetWorthChange(BaseModel):
    character_id: int
    delta: int


class NetWorthTransactionCreate(BaseModel):
    # FLUCTUATION is system-generated (see /periods/{id}/archive).
    kind: TransactionKind = TransactionKind.ADJUSTMENT
    # Defaults to the crisis note's title when omitted.
    description: str | None = None
    changes: list[NetWorthChange] = Field(min_length=1)
    # Every manual change must be justified by a crisis note: either link an
    # existing one or create a new one alongside the change.
    crisis_note_id: int | None = None
    crisis_note: CrisisNoteCreate | None = None

    @model_validator(mode="after")
    def _one_crisis_note(self) -> NetWorthTransactionCreate:
        if (self.crisis_note_id is None) == (self.crisis_note is None):
            raise ValueError("Provide exactly one of crisis_note_id or crisis_note.")
        return self


class LinkedCrisisNote(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    note_type: NoteType


class NetWorthEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    character_id: int
    character_name: str
    delta: int
    balance_after: int


class NetWorthTransactionResponse(BaseModel):
    id: int
    kind: TransactionKind
    description: str
    created_at: datetime
    period_id: int | None
    crisis_note: LinkedCrisisNote | None
    entries: list[NetWorthEntryResponse]


class NetWorthHistoryPoint(BaseModel):
    at: datetime
    net_worth: int
    kind: TransactionKind | None


# ── Wax Seals ────────────────────────────────────────────────────────────────

class DelegateSeals(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    seal_count: int


class SealGrant(BaseModel):
    character_id: int
    quantity: int = Field(ge=1, le=100)


class SealIssue(BaseModel):
    """Staff hand out seals, e.g. starting allotments or crisis-team rewards."""

    grants: list[SealGrant] = Field(min_length=1)
    reason: str | None = None


class SealTransfer(BaseModel):
    """A delegate gives, trades, pledges (or is extorted out of) seals."""

    from_character_id: int
    to_character_id: int
    quantity: int = Field(ge=1, le=100)
    reason: str | None = None


class SealSpend(BaseModel):
    """Seals attached to a crisis note or directive. A delegate may spend
    their seals on someone else's note or directive."""

    character_id: int
    quantity: int = Field(ge=1, le=100)
    crisis_note_id: int | None = None
    directive_id: int | None = None
    reason: str | None = None

    @model_validator(mode="after")
    def _one_target(self) -> SealSpend:
        if (self.crisis_note_id is None) == (self.directive_id is None):
            raise ValueError("Attach the seals to exactly one crisis note or directive.")
        return self


class SealRevoke(BaseModel):
    """Staff take seals back (corrections)."""

    character_id: int
    quantity: int = Field(ge=1, le=100)
    reason: str = Field(min_length=1)


class LinkedDirective(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    note_type: DelegateNoteType


class SealMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: SealAction
    quantity: int
    from_character: CharacterResponse | None
    to_character: CharacterResponse | None
    crisis_note: LinkedCrisisNote | None
    directive: LinkedDirective | None
    reason: str | None
    created_at: datetime


# ── Delegate Notes ───────────────────────────────────────────────────────────

class DelegateNoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    note_type: DelegateNoteType
    character_ids: list[int] = Field(min_length=1)
    contents: str = Field(min_length=1)
    # Wax seals attached to the directive, spent in the same commit.
    seals: list[SealGrant] = Field(default_factory=list)


class DelegateNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    note_type: DelegateNoteType
    contents: str
    characters: list[CharacterResponse]
    period_id: int | None
    # Total wax seals attached to (spent on) this directive.
    seals: int = 0
    created_at: datetime
