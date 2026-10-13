from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.api.seals import spend_seals
from app.database import get_db
from app.models.crisis_note import Character, CrisisPeriod
from app.models.mechanics import DelegateNote, DelegateNoteType, SealAction, SealMovement
from app.schemas import DelegateNoteCreate, DelegateNoteResponse

router = APIRouter(prefix="/delegate-notes", tags=["delegate-notes"])


def _with_seals(db: Session, notes: list[DelegateNote]) -> list[DelegateNoteResponse]:
    """Attach each directive's total spent seals."""
    totals = dict(
        db.query(SealMovement.directive_id, func.sum(SealMovement.quantity))
        .filter(
            SealMovement.action == SealAction.SPENT,
            SealMovement.directive_id.in_([n.id for n in notes]),
        )
        .group_by(SealMovement.directive_id)
        .all()
    )
    return [
        DelegateNoteResponse.model_validate(n).model_copy(update={"seals": totals.get(n.id, 0)})
        for n in notes
    ]


@router.get("", response_model=list[DelegateNoteResponse])
def list_delegate_notes(
    period_id: int | None = Query(None),
    archived_only: bool = Query(False),
    character_id: int | None = Query(None),
    note_type: DelegateNoteType | None = Query(None),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[DelegateNoteResponse]:
    query = db.query(DelegateNote).options(selectinload(DelegateNote.characters))
    if period_id is not None:
        query = query.filter(DelegateNote.period_id == period_id)
    elif archived_only:
        query = query.join(CrisisPeriod).filter(CrisisPeriod.is_active.is_(False))
    if character_id is not None:
        query = query.filter(DelegateNote.characters.any(Character.id == character_id))
    if note_type is not None:
        query = query.filter(DelegateNote.note_type == note_type)
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            DelegateNote.title.ilike(pattern) | DelegateNote.contents.ilike(pattern)
        )
    notes = query.order_by(DelegateNote.created_at.desc(), DelegateNote.id.desc()).all()
    return _with_seals(db, notes)


@router.post("", response_model=DelegateNoteResponse, status_code=status.HTTP_201_CREATED)
def create_delegate_note(
    body: DelegateNoteCreate, db: Session = Depends(get_db)
) -> DelegateNoteResponse:
    active_period = db.query(CrisisPeriod).filter(CrisisPeriod.is_active.is_(True)).first()
    if not active_period:
        raise HTTPException(status_code=422, detail="No active period. Create a period first.")
    ids = set(body.character_ids)
    characters = db.query(Character).filter(Character.id.in_(ids)).all()
    if len(characters) != len(ids):
        raise HTTPException(status_code=404, detail="One or more delegates were not found.")
    note = DelegateNote(
        title=body.title.strip(),
        note_type=body.note_type,
        contents=body.contents,
        characters=characters,
        period=active_period,
    )
    db.add(note)
    # Seals attached to the directive are spent in the same commit; if any
    # delegate is short, nothing is saved.
    spend_seals(db, body.seals, directive=note)
    db.commit()
    db.refresh(note)
    return _with_seals(db, [note])[0]


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_delegate_note(note_id: int, db: Session = Depends(get_db)) -> None:
    note = db.get(DelegateNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    db.delete(note)
    db.commit()
