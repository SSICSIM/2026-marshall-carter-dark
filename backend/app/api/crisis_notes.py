from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.crisis_note import Character, CrisisNote, CrisisPeriod, NoteType, Priority
from app.schemas import (
    AnalyticsSummary,
    CrisisNoteCreate,
    CrisisNoteResponse,
    CrisisNoteUpdate,
    NotesByCharacter,
    PriorityCount,
)

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/analytics", response_model=AnalyticsSummary)
def get_analytics(
    period_id: int | None = Query(None),
    db: Session = Depends(get_db),
) -> AnalyticsSummary:
    period_filter = [CrisisNote.period_id == period_id] if period_id is not None else []

    if period_id is not None and not db.get(CrisisPeriod, period_id):
        raise HTTPException(status_code=404, detail="Period not found.")

    total = db.query(func.count(CrisisNote.id)).filter(*period_filter).scalar() or 0

    by_char_rows = db.execute(
        select(Character.name, func.count(CrisisNote.id).label("cnt"))
        .join(CrisisNote, CrisisNote.character_id == Character.id)
        .where(*period_filter)
        .group_by(Character.name)
        .order_by(func.count(CrisisNote.id).desc())
    ).all()

    by_priority_rows = db.execute(
        select(CrisisNote.priority, func.count(CrisisNote.id).label("cnt"))
        .where(*period_filter)
        .group_by(CrisisNote.priority)
    ).all()

    private_count = (
        db.query(func.count(CrisisNote.id))
        .filter(*period_filter, CrisisNote.note_type == NoteType.PRIVATE_DIRECTIVE)
        .scalar()
        or 0
    )
    public_count = (
        db.query(func.count(CrisisNote.id))
        .filter(*period_filter, CrisisNote.note_type == NoteType.PUBLIC_DIRECTIVE)
        .scalar()
        or 0
    )

    return AnalyticsSummary(
        total_notes=total,
        notes_by_character=[NotesByCharacter(character_name=r[0], count=r[1]) for r in by_char_rows],
        priority_distribution=[PriorityCount(priority=r[0], count=r[1]) for r in by_priority_rows],
        private_directive_count=private_count,
        public_directive_count=public_count,
    )


@router.get("", response_model=list[CrisisNoteResponse])
def list_notes(
    period_id: int | None = Query(None),
    archived_only: bool = Query(False),
    character_id: int | None = Query(None),
    priority: Priority | None = Query(None),
    note_type: NoteType | None = Query(None),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[CrisisNote]:
    query = db.query(CrisisNote)
    if period_id is not None:
        query = query.filter(CrisisNote.period_id == period_id)
    elif archived_only:
        query = query.join(CrisisPeriod).filter(CrisisPeriod.is_active.is_(False))
    if character_id is not None:
        query = query.filter(CrisisNote.character_id == character_id)
    if priority is not None:
        query = query.filter(CrisisNote.priority == priority)
    if note_type is not None:
        query = query.filter(CrisisNote.note_type == note_type)
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            CrisisNote.title.ilike(pattern) | CrisisNote.description.ilike(pattern)
        )
    return query.order_by(CrisisNote.created_at.desc()).all()


def build_note(db: Session, body: CrisisNoteCreate) -> CrisisNote:
    """Validate and construct (but don't commit) a crisis note in the active
    period. Shared with net worth transactions, which create their
    justifying note in the same commit as the money change."""
    active_period = db.query(CrisisPeriod).filter(CrisisPeriod.is_active.is_(True)).first()
    if not active_period:
        raise HTTPException(status_code=422, detail="No active period. Create a period first.")

    if body.period_id is not None and body.period_id != active_period.id:
        # The client's view of the active period is stale (e.g. it was
        # archived while they had the form open) — refuse rather than
        # silently filing the note under a different period than they saw.
        raise HTTPException(
            status_code=409,
            detail="The active period has changed since you opened this form. Refresh and try again.",
        )

    character = db.get(Character, body.character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found.")

    return CrisisNote(
        character_id=body.character_id,
        period_id=active_period.id,
        title=body.title,
        description=body.description,
        crisis_staff_notes=body.crisis_staff_notes,
        priority=body.priority,
        note_type=body.note_type,
    )


@router.post("", response_model=CrisisNoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(body: CrisisNoteCreate, db: Session = Depends(get_db)) -> CrisisNote:
    note = build_note(db, body)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/{note_id}", response_model=CrisisNoteResponse)
def update_note(note_id: int, body: CrisisNoteUpdate, db: Session = Depends(get_db)) -> CrisisNote:
    note = db.get(CrisisNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")

    updates = body.model_dump(exclude_unset=True)
    if "character_id" in updates:
        character = db.get(Character, updates["character_id"])
        if not character:
            raise HTTPException(status_code=404, detail="Character not found.")

    for field, value in updates.items():
        setattr(note, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not save this note — check the submitted values.")
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_note(note_id: int, db: Session = Depends(get_db)) -> None:
    note = db.get(CrisisNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    db.delete(note)
    db.commit()
