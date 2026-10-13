"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActivePeriod } from "@/hooks/useCrisisPeriods";
import { useCreateNetWorthTransaction } from "@/hooks/useMechanics";
import type { DelegateNetWorth } from "@/types/api";
import {
  CrisisNoteField,
  EMPTY_NOTE_CHOICE,
  isNoteChoiceValid,
  notePayload,
  withDefaultCharacter,
  type CrisisNoteChoice,
} from "./CrisisNoteField";
import { formatMoney } from "./format";
import { FieldSelect } from "./pickers";

const SUGGESTED_PCTS = [-0.1, -0.05, 0.05, 0.1];

interface Row {
  key: number;
  delegateId: number | null;
  delta: string;
}

/** Delegate select + signed amount + suggested % shortcuts. */
function DeltaField(props: {
  delegates: DelegateNetWorth[];
  row: Row;
  title?: string;
  onChange: (patch: Partial<Row>) => void;
  onRemove?: () => void;
}) {
  const delegate = props.delegates.find((d) => d.id === props.row.delegateId);
  const inputId = `delta-${props.row.key}`;
  const delta = parseDelta(props.row.delta);
  // Balance after this change; NaN until both a delegate and amount are set.
  const after = delegate && Number.isFinite(delta) ? delegate.net_worth + delta : NaN;
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`delegate-${props.row.key}`}>{props.title ?? "Delegate"}</Label>
        {props.onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={props.onRemove}
            aria-label="Remove delegate"
          >
            <X />
          </Button>
        )}
      </div>
      <FieldSelect
        id={`delegate-${props.row.key}`}
        value={props.row.delegateId}
        placeholder="Select delegate…"
        options={props.delegates.map((d) => ({ value: d.id, label: d.name }))}
        onChange={(delegateId) => props.onChange({ delegateId })}
      />
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor={inputId}>Change ($)</Label>
          {delegate && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {Number.isFinite(after)
                ? `${formatMoney(delegate.net_worth)} → ${formatMoney(after)}`
                : `Current ${formatMoney(delegate.net_worth)}`}
            </span>
          )}
        </div>
        <Input
          id={inputId}
          type="number"
          step={1}
          inputMode="numeric"
          placeholder="e.g. 25000 or -25000"
          value={props.row.delta}
          onChange={(e) => props.onChange({ delta: e.target.value })}
        />
        {after < 0 && (
          <p className="text-xs text-destructive">
            This leaves {delegate?.name} in debt ({formatMoney(after)}). Allowed, but double-check.
          </p>
        )}
        <div className="grid grid-cols-4 gap-1.5">
          {SUGGESTED_PCTS.map((pct) => (
            <Button
              key={pct}
              type="button"
              variant="outline"
              size="sm"
              className={pct < 0 ? "text-destructive" : "text-chart-2"}
              disabled={!delegate}
              onClick={() =>
                delegate && props.onChange({ delta: String(Math.round(delegate.net_worth * pct)) })
              }
            >
              {pct > 0 ? "+" : ""}
              {pct * 100}%
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

const parseDelta = (s: string) => (s.trim() === "" ? NaN : Number(s));
const isValidDelta = (s: string) => Number.isInteger(parseDelta(s)) && parseDelta(s) !== 0;

/** Crisis-note state shared by both dialogs, defaulted to the involved delegates. */
function useNoteChoice(open: boolean, involved: { id: number; name: string }[]) {
  const [raw, setRaw] = useState<CrisisNoteChoice>(EMPTY_NOTE_CHOICE);
  const { data: activePeriod } = useActivePeriod();
  useEffect(() => {
    if (open) setRaw(EMPTY_NOTE_CHOICE);
  }, [open]);
  const note = withDefaultCharacter(raw, involved);
  return {
    note,
    field: (
      <CrisisNoteField
        value={note}
        involved={involved}
        onChange={(patch) => setRaw((n) => ({ ...n, ...patch }))}
      />
    ),
    isValid: isNoteChoiceValid(note, activePeriod?.id),
    payload: () => notePayload(note, activePeriod?.id),
  };
}

function involvedDelegates(delegates: DelegateNetWorth[], ids: (number | null)[]) {
  return ids.flatMap((id) => delegates.filter((d) => d.id === id));
}

let nextKey = 0;
const newRow = (delegateId: number | null = null): Row => ({ key: nextKey++, delegateId, delta: "" });

/**
 * Add/subtract net worth for one delegate, or several at once ("+ Add
 * delegate") under a single crisis note — the bulk flow for directives.
 */
export function EditNetWorthDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegates: DelegateNetWorth[] | undefined;
  defaultDelegateId?: number;
}) {
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const { mutate, isPending } = useCreateNetWorthTransaction();

  useEffect(() => {
    if (props.open) setRows([newRow(props.defaultDelegateId ?? null)]);
  }, [props.open, props.defaultDelegateId]);

  const delegates = props.delegates ?? [];
  const ids = rows.map((r) => r.delegateId);
  const crisisNote = useNoteChoice(props.open, involvedDelegates(delegates, ids));
  const isValid =
    crisisNote.isValid &&
    rows.every((r) => r.delegateId !== null && isValidDelta(r.delta)) &&
    new Set(ids).size === ids.length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    mutate(
      {
        kind: "ADJUSTMENT",
        changes: rows.map((r) => ({ character_id: r.delegateId!, delta: parseDelta(r.delta) })),
        ...crisisNote.payload(),
      },
      { onSuccess: () => props.onOpenChange(false) }
    );
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Net Worth</DialogTitle>
          <DialogDescription>
            Add or subtract money. Add several delegates to apply a directive in bulk.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {rows.map((row) => (
            <DeltaField
                key={row.key}
                delegates={delegates}
                row={row}
                onChange={(patch) =>
                  setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, ...patch } : r)))
                }
                onRemove={
                  rows.length > 1
                    ? () => setRows((rs) => rs.filter((r) => r.key !== row.key))
                    : undefined
                }
              />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRows((rs) => [...rs, newRow()])}
          >
            <Plus /> Add another delegate
          </Button>
          {new Set(ids).size !== ids.length && (
            <p className="text-sm text-destructive">Each delegate can only appear once.</p>
          )}
          {crisisNote.field}
          <DialogFooter>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Move money between two delegates. Amounts don't have to mirror: the
 * second delegate's difference follows the first (negated) until edited.
 */
export function TransferDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegates: DelegateNetWorth[] | undefined;
  defaultDelegateId?: number;
}) {
  const [from, setFrom] = useState<Row>(newRow());
  const [to, setTo] = useState<Row>(newRow());
  const [toTouched, setToTouched] = useState(false);
  const { mutate, isPending } = useCreateNetWorthTransaction();
  const delegates = props.delegates ?? [];
  const crisisNote = useNoteChoice(
    props.open,
    involvedDelegates(delegates, [from.delegateId, to.delegateId])
  );

  useEffect(() => {
    if (props.open) {
      setFrom(newRow(props.defaultDelegateId ?? null));
      setTo(newRow());
      setToTouched(false);
    }
  }, [props.open, props.defaultDelegateId]);

  function changeFrom(patch: Partial<Row>) {
    setFrom((r) => ({ ...r, ...patch }));
    if (patch.delta !== undefined && !toTouched) {
      const n = parseDelta(patch.delta);
      setTo((r) => ({ ...r, delta: Number.isFinite(n) && n !== 0 ? String(-n) : "" }));
    }
  }

  function changeTo(patch: Partial<Row>) {
    setTo((r) => ({ ...r, ...patch }));
    if (patch.delta !== undefined) setToTouched(true);
  }

  const isValid =
    crisisNote.isValid &&
    from.delegateId !== null &&
    to.delegateId !== null &&
    from.delegateId !== to.delegateId &&
    isValidDelta(from.delta) &&
    isValidDelta(to.delta);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    mutate(
      {
        kind: "TRANSFER",
        changes: [
          { character_id: from.delegateId!, delta: parseDelta(from.delta) },
          { character_id: to.delegateId!, delta: parseDelta(to.delta) },
        ],
        ...crisisNote.payload(),
      },
      { onSuccess: () => props.onOpenChange(false) }
    );
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer</DialogTitle>
          <DialogDescription>Move money from one delegate to another.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <DeltaField title="From" delegates={delegates} row={from} onChange={changeFrom} />
          <DeltaField title="To" delegates={delegates} row={to} onChange={changeTo} />
          <p className="text-xs text-muted-foreground">
            The second amount mirrors the first until you edit it, so transfers can be uneven.
          </p>
          {from.delegateId !== null && from.delegateId === to.delegateId && (
            <p className="text-sm text-destructive">Pick two different delegates.</p>
          )}
          {crisisNote.field}
          <DialogFooter>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? "Saving…" : "Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
