from __future__ import annotations

import random

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from app.api.crisis_notes import build_note
from app.database import get_db
from app.models.crisis_note import Character, CrisisNote, CrisisPeriod
from app.models.mechanics import NetWorthEntry, NetWorthTransaction, TransactionKind
from app.schemas import (
    DelegateNetWorth,
    LinkedCrisisNote,
    NetWorthEntryResponse,
    NetWorthHistoryPoint,
    NetWorthTransactionCreate,
    NetWorthTransactionResponse,
)

router = APIRouter(prefix="/net-worth", tags=["net-worth"])

# Each crisis update moves every eligible delegate's net worth by a random
# amount within ±FLUCTUATION_PCT.
FLUCTUATION_PCT = 0.03


def _to_response(txn: NetWorthTransaction) -> NetWorthTransactionResponse:
    return NetWorthTransactionResponse(
        id=txn.id,
        kind=txn.kind,
        description=txn.description,
        created_at=txn.created_at,
        period_id=txn.period_id,
        crisis_note=LinkedCrisisNote.model_validate(txn.crisis_note) if txn.crisis_note else None,
        entries=[
            NetWorthEntryResponse(
                character_id=e.character_id,
                character_name=e.character.name,
                delta=e.delta,
                balance_after=e.balance_after,
            )
            for e in txn.entries
        ],
    )


def _load_transaction(db: Session, txn_id: int) -> NetWorthTransaction:
    return (
        db.query(NetWorthTransaction)
        .options(
            selectinload(NetWorthTransaction.entries).selectinload(NetWorthEntry.character),
            selectinload(NetWorthTransaction.crisis_note),
        )
        .filter(NetWorthTransaction.id == txn_id)
        .one()
    )


@router.get("", response_model=list[DelegateNetWorth])
def list_net_worths(db: Session = Depends(get_db)) -> list[Character]:
    return db.query(Character).order_by(Character.name).all()


@router.get("/transactions", response_model=list[NetWorthTransactionResponse])
def list_transactions(
    character_id: int | None = Query(None),
    period_id: int | None = Query(None),
    archived_only: bool = Query(False),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[NetWorthTransactionResponse]:
    query = db.query(NetWorthTransaction).options(
        selectinload(NetWorthTransaction.entries).selectinload(NetWorthEntry.character),
        selectinload(NetWorthTransaction.crisis_note),
    )
    if period_id is not None:
        query = query.filter(NetWorthTransaction.period_id == period_id)
    elif archived_only:
        query = query.join(CrisisPeriod).filter(CrisisPeriod.is_active.is_(False))
    if character_id is not None:
        query = query.filter(
            NetWorthTransaction.entries.any(NetWorthEntry.character_id == character_id)
        )
    txns = query.order_by(NetWorthTransaction.id.desc()).limit(limit).all()
    return [_to_response(t) for t in txns]


@router.post(
    "/transactions",
    response_model=NetWorthTransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    body: NetWorthTransactionCreate, db: Session = Depends(get_db)
) -> NetWorthTransactionResponse:
    if body.kind == TransactionKind.FLUCTUATION:
        raise HTTPException(
            status_code=422, detail="Fluctuations are applied by running a crisis update."
        )
    active_period = db.query(CrisisPeriod).filter(CrisisPeriod.is_active.is_(True)).first()
    ids = [c.character_id for c in body.changes]
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=422, detail="Each delegate can only appear once.")
    if body.kind == TransactionKind.TRANSFER and len(ids) < 2:
        raise HTTPException(status_code=422, detail="A transfer needs at least two delegates.")

    # Lock the affected rows so concurrent edits to the same delegate
    # serialize instead of overwriting each other's balance.
    characters = {
        c.id: c
        for c in db.query(Character).filter(Character.id.in_(ids)).with_for_update().all()
    }
    missing = set(ids) - characters.keys()
    if missing:
        raise HTTPException(status_code=404, detail=f"Delegate(s) not found: {sorted(missing)}")

    if body.crisis_note is not None:
        note = build_note(db, body.crisis_note)
        db.add(note)
    else:
        note = db.get(CrisisNote, body.crisis_note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Crisis note not found.")

    description = (body.description or "").strip() or note.title
    txn = NetWorthTransaction(
        kind=body.kind, description=description, crisis_note=note, period=active_period
    )
    for change in body.changes:
        character = characters[change.character_id]
        character.net_worth += change.delta
        # Manual changes are final until the next crisis update.
        character.skip_fluctuation = True
        txn.entries.append(
            NetWorthEntry(
                character_id=character.id, delta=change.delta, balance_after=character.net_worth
            )
        )
    db.add(txn)
    db.commit()
    return _to_response(_load_transaction(db, txn.id))


def apply_market_movement(db: Session, period: CrisisPeriod) -> NetWorthTransaction | None:
    """The net worth half of a crisis update (see archive_period): snapshot
    every delegate's baseline, then apply a random ±3% move to everyone not
    manually edited since the last update, and clear the skip flags. Filed
    under ``period``, the round the update opens. Doesn't commit; returns
    None when there are no delegates."""
    characters = db.query(Character).order_by(Character.id).with_for_update().all()
    if not characters:
        return None

    txn = NetWorthTransaction(
        kind=TransactionKind.FLUCTUATION, description="Crisis update market movement", period=period
    )
    for character in characters:
        character.baseline_net_worth = character.net_worth
        if character.skip_fluctuation:
            character.skip_fluctuation = False
            continue
        delta = round(character.net_worth * random.uniform(-FLUCTUATION_PCT, FLUCTUATION_PCT))
        if delta == 0:
            continue
        character.net_worth += delta
        txn.entries.append(
            NetWorthEntry(
                character_id=character.id, delta=delta, balance_after=character.net_worth
            )
        )
    db.add(txn)
    return txn


@router.get("/{character_id}/history", response_model=list[NetWorthHistoryPoint])
def get_history(character_id: int, db: Session = Depends(get_db)) -> list[NetWorthHistoryPoint]:
    character = db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Delegate not found.")
    rows = (
        db.query(NetWorthEntry, NetWorthTransaction)
        .join(NetWorthTransaction, NetWorthEntry.transaction_id == NetWorthTransaction.id)
        .filter(NetWorthEntry.character_id == character_id)
        .order_by(NetWorthEntry.id)
        .all()
    )
    # Starting point: the balance before the first recorded change. Skipped
    # when that's the pre-setup $0, which would flatten the chart's scale.
    start = rows[0][0].balance_after - rows[0][0].delta if rows else character.net_worth
    points = []
    if start != 0 or not rows:
        points.append(NetWorthHistoryPoint(at=character.created_at, net_worth=start, kind=None))
    points += [
        NetWorthHistoryPoint(at=txn.created_at, net_worth=entry.balance_after, kind=txn.kind)
        for entry, txn in rows
    ]
    return points
