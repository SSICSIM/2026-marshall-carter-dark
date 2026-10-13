"""Wax seals of approval.

Each delegate holds a number of seals (``Character.seal_count``). Staff
issue them (starting allotments, crisis-team rewards), delegates transfer
them to one another, and they're spent by attaching them to a crisis note or
directive — after which they're gone. Every change is written to the
``seal_movements`` ledger in the same commit as the balance change, with the
affected delegates' rows locked, so the log always explains the balances.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.crisis_note import Character, CrisisNote
from app.models.mechanics import DelegateNote, SealAction, SealMovement
from app.schemas import (
    DelegateSeals,
    SealGrant,
    SealIssue,
    SealMovementResponse,
    SealRevoke,
    SealSpend,
    SealTransfer,
)

router = APIRouter(prefix="/seals", tags=["seals"])


def _lock(db: Session, ids: list[int]) -> dict[int, Character]:
    """Lock the delegates whose balances are about to change."""
    characters = {
        c.id: c
        for c in db.query(Character).filter(Character.id.in_(ids)).with_for_update().all()
    }
    missing = set(ids) - characters.keys()
    if missing:
        raise HTTPException(status_code=404, detail=f"Delegate(s) not found: {sorted(missing)}")
    return characters


def _take(character: Character, quantity: int) -> None:
    if character.seal_count < quantity:
        raise HTTPException(
            status_code=409,
            detail=f"{character.name} only has {character.seal_count} seal(s).",
        )
    character.seal_count -= quantity


def spend_seals(
    db: Session,
    grants: list[SealGrant],
    *,
    crisis_note: CrisisNote | None = None,
    directive: DelegateNote | None = None,
    reason: str | None = None,
) -> None:
    """Spend seals from one or more delegates on a note/directive, without
    committing. Shared with directive creation so seals attached to a new
    directive are spent in the same commit."""
    if not grants:
        return
    totals: dict[int, int] = {}
    for g in grants:
        totals[g.character_id] = totals.get(g.character_id, 0) + g.quantity
    characters = _lock(db, list(totals))
    for character_id, quantity in totals.items():
        _take(characters[character_id], quantity)
        db.add(
            SealMovement(
                action=SealAction.SPENT,
                quantity=quantity,
                from_character_id=character_id,
                crisis_note=crisis_note,
                directive=directive,
                reason=reason,
            )
        )


@router.get("", response_model=list[DelegateSeals])
def list_holdings(db: Session = Depends(get_db)) -> list[Character]:
    return db.query(Character).order_by(Character.name).all()


@router.get("/movements", response_model=list[SealMovementResponse])
def list_movements(
    character_id: int | None = Query(None, description="Movements into or out of this delegate"),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
) -> list[SealMovement]:
    query = db.query(SealMovement).options(
        selectinload(SealMovement.from_character),
        selectinload(SealMovement.to_character),
        selectinload(SealMovement.crisis_note),
        selectinload(SealMovement.directive),
    )
    if character_id is not None:
        query = query.filter(
            or_(
                SealMovement.from_character_id == character_id,
                SealMovement.to_character_id == character_id,
            )
        )
    return query.order_by(SealMovement.created_at.desc(), SealMovement.id.desc()).limit(limit).all()


@router.post("/issue", status_code=status.HTTP_201_CREATED, response_model=None)
def issue_seals(body: SealIssue, db: Session = Depends(get_db)) -> None:
    totals: dict[int, int] = {}
    for g in body.grants:
        totals[g.character_id] = totals.get(g.character_id, 0) + g.quantity
    characters = _lock(db, list(totals))
    for character_id, quantity in totals.items():
        characters[character_id].seal_count += quantity
        db.add(
            SealMovement(
                action=SealAction.ISSUED,
                quantity=quantity,
                to_character_id=character_id,
                reason=body.reason,
            )
        )
    db.commit()


@router.post("/transfer", status_code=status.HTTP_201_CREATED, response_model=None)
def transfer_seals(body: SealTransfer, db: Session = Depends(get_db)) -> None:
    if body.from_character_id == body.to_character_id:
        raise HTTPException(status_code=422, detail="Pick two different delegates.")
    characters = _lock(db, [body.from_character_id, body.to_character_id])
    _take(characters[body.from_character_id], body.quantity)
    characters[body.to_character_id].seal_count += body.quantity
    db.add(
        SealMovement(
            action=SealAction.TRANSFERRED,
            quantity=body.quantity,
            from_character_id=body.from_character_id,
            to_character_id=body.to_character_id,
            reason=body.reason,
        )
    )
    db.commit()


@router.post("/spend", status_code=status.HTTP_201_CREATED, response_model=None)
def spend(body: SealSpend, db: Session = Depends(get_db)) -> None:
    crisis_note = directive = None
    if body.crisis_note_id is not None:
        crisis_note = db.get(CrisisNote, body.crisis_note_id)
        if not crisis_note:
            raise HTTPException(status_code=404, detail="Crisis note not found.")
    else:
        directive = db.get(DelegateNote, body.directive_id)
        if not directive:
            raise HTTPException(status_code=404, detail="Directive not found.")
    spend_seals(
        db,
        [SealGrant(character_id=body.character_id, quantity=body.quantity)],
        crisis_note=crisis_note,
        directive=directive,
        reason=body.reason,
    )
    db.commit()


@router.post("/revoke", status_code=status.HTTP_201_CREATED, response_model=None)
def revoke_seals(body: SealRevoke, db: Session = Depends(get_db)) -> None:
    character = _lock(db, [body.character_id])[body.character_id]
    _take(character, body.quantity)
    db.add(
        SealMovement(
            action=SealAction.REVOKED,
            quantity=body.quantity,
            from_character_id=body.character_id,
            reason=body.reason,
        )
    )
    db.commit()
