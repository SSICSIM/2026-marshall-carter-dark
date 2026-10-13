"use client";

import { useEffect, useState } from "react";
import { Plus, Users, X } from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotes } from "@/hooks/useCrisisNotes";
import { useActivePeriod } from "@/hooks/useCrisisPeriods";
import {
  useDelegateNotes,
  useIssueSeals,
  useRevokeSeals,
  useSpendSeals,
  useTransferSeals,
} from "@/hooks/useMechanics";
import type { DelegateSeals } from "@/types/api";
import { NOTE_TYPE_LABEL } from "./format";
import { FieldSelect } from "./pickers";

const seals = (n: number) => `${n} seal${n === 1 ? "" : "s"}`;

function delegateOptions(delegates: DelegateSeals[], exclude?: number | null) {
  return delegates
    .filter((d) => d.id !== exclude)
    .map((d) => ({ value: d.id, label: `${d.name} (${seals(d.seal_count)})` }));
}

function QuantityField(props: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>
        Seals{props.max !== undefined && <span className="text-muted-foreground"> (max {props.max})</span>}
      </Label>
      <Input
        id={props.id}
        type="number"
        min={1}
        max={props.max}
        className="w-28"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

function ReasonField(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor="seal-reason">
        Reason{!props.required && <span className="text-muted-foreground"> (optional)</span>}
      </Label>
      <Input
        id="seal-reason"
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

const parseQty = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);
const validQty = (s: string, max = 100) => {
  const n = parseQty(s);
  return Number.isInteger(n) && n >= 1 && n <= Math.min(max, 100);
};

interface GrantRow {
  key: number;
  delegateId: number | null;
  quantity: string;
}
let nextKey = 0;
const newRow = (delegateId: number | null = null, quantity = "1"): GrantRow => ({
  key: nextKey++,
  delegateId,
  quantity,
});

/**
 * Staff hand out seals: starting allotments (uneven by design) or rewards
 * from the crisis team. Several delegates at once.
 */
export function IssueSealsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegates: DelegateSeals[] | undefined;
  defaultDelegateId?: number;
}) {
  const [rows, setRows] = useState<GrantRow[]>([newRow()]);
  const [reason, setReason] = useState("");
  const { mutate, isPending } = useIssueSeals();
  const delegates = props.delegates ?? [];

  useEffect(() => {
    if (props.open) {
      setRows([newRow(props.defaultDelegateId ?? null)]);
      setReason("");
    }
  }, [props.open, props.defaultDelegateId]);

  const ids = rows.map((r) => r.delegateId);
  const duplicate = new Set(ids).size !== ids.length;
  const isValid =
    !duplicate && rows.every((r) => r.delegateId !== null && validQty(r.quantity));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    mutate(
      {
        grants: rows.map((r) => ({ character_id: r.delegateId!, quantity: parseQty(r.quantity) })),
        reason: reason.trim() || undefined,
      },
      { onSuccess: () => props.onOpenChange(false) }
    );
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue Wax Seals</DialogTitle>
          <DialogDescription>
            Starting allotments or rewards from the crisis team.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {rows.map((row) => (
            <div key={row.key} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label>Delegate</Label>
                <FieldSelect
                  value={row.delegateId}
                  placeholder="Select delegate…"
                  options={delegateOptions(delegates)}
                  onChange={(delegateId) =>
                    setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, delegateId } : r)))
                  }
                />
              </div>
              <QuantityField
                id={`issue-qty-${row.key}`}
                value={row.quantity}
                onChange={(quantity) =>
                  setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, quantity } : r)))
                }
              />
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove delegate"
                  onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                >
                  <X />
                </Button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRows((rs) => [...rs, newRow()])}
            >
              <Plus /> Add another delegate
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRows(delegates.map((d) => newRow(d.id)))}
            >
              <Users /> Add every delegate
            </Button>
          </div>
          {duplicate && (
            <p className="text-sm text-destructive">Each delegate can only appear once.</p>
          )}
          <ReasonField
            value={reason}
            onChange={setReason}
            placeholder="e.g. Starting allotment, or Crisis team reward"
          />
          <DialogFooter>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? "Issuing…" : "Issue Seals"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type SealActionMode = "transfer" | "spend" | "revoke";

const MODE_COPY: Record<SealActionMode, { title: string; description: string; submit: string }> = {
  transfer: {
    title: "Transfer Wax Seals",
    description: "Seals given, traded, pledged or extorted between delegates.",
    submit: "Transfer",
  },
  spend: {
    title: "Spend Wax Seals",
    description:
      "Seals attached to a crisis note or directive. They go to the crisis room and are gone. A delegate can spend seals on someone else's note.",
    submit: "Spend",
  },
  revoke: {
    title: "Revoke Wax Seals",
    description: "Take seals back from a delegate, e.g. to correct a mistake.",
    submit: "Revoke",
  },
};

/** Transfer, spend or revoke seals; balances are shown and can't be overdrawn. */
export function SealActionDialog(props: {
  mode: SealActionMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegates: DelegateSeals[] | undefined;
  defaultDelegateId?: number;
}) {
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<"crisis_note" | "directive">("crisis_note");
  const [targetId, setTargetId] = useState<number | null>(null);

  const transfer = useTransferSeals();
  const spend = useSpendSeals();
  const revoke = useRevokeSeals();
  const isPending = transfer.isPending || spend.isPending || revoke.isPending;

  const { data: activePeriod, isLoading: periodLoading } = useActivePeriod();
  const { data: crisisNotes } = useNotes(
    activePeriod ? { period_id: activePeriod.id } : {},
    props.mode === "spend" && !periodLoading
  );
  const { data: directives } = useDelegateNotes();

  useEffect(() => {
    if (props.open) {
      setFromId(props.defaultDelegateId ?? null);
      setToId(null);
      setQuantity("1");
      setReason("");
      setTarget("crisis_note");
      setTargetId(null);
    }
  }, [props.open, props.defaultDelegateId, props.mode]);

  const delegates = props.delegates ?? [];
  const from = delegates.find((d) => d.id === fromId);
  const max = from?.seal_count ?? 0;
  const copy = MODE_COPY[props.mode];

  const isValid =
    fromId !== null &&
    max > 0 &&
    validQty(quantity, max) &&
    (props.mode !== "transfer" || (toId !== null && toId !== fromId)) &&
    (props.mode !== "spend" || targetId !== null) &&
    (props.mode !== "revoke" || reason.trim() !== "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    const done = { onSuccess: () => props.onOpenChange(false) };
    const qty = parseQty(quantity);
    const why = reason.trim() || undefined;
    if (props.mode === "transfer") {
      transfer.mutate(
        { from_character_id: fromId!, to_character_id: toId!, quantity: qty, reason: why },
        done
      );
    } else if (props.mode === "spend") {
      const link =
        target === "crisis_note" ? { crisis_note_id: targetId! } : { directive_id: targetId! };
      spend.mutate({ character_id: fromId!, quantity: qty, reason: why, ...link }, done);
    } else {
      revoke.mutate({ character_id: fromId!, quantity: qty, reason: reason.trim() }, done);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label>{props.mode === "spend" ? "Whose seals" : props.mode === "transfer" ? "From" : "Delegate"}</Label>
            <FieldSelect
              value={fromId}
              placeholder="Select delegate…"
              options={delegateOptions(delegates)}
              onChange={setFromId}
            />
            {from && max === 0 && (
              <p className="text-sm text-destructive">{from.name} has no seals.</p>
            )}
          </div>

          {props.mode === "transfer" && (
            <div className="space-y-1">
              <Label>To</Label>
              <FieldSelect
                value={toId}
                placeholder="Select delegate…"
                options={delegateOptions(delegates, fromId)}
                onChange={setToId}
              />
            </div>
          )}

          <QuantityField
            id="seal-qty"
            value={quantity}
            onChange={setQuantity}
            max={from ? max : undefined}
          />

          {props.mode === "spend" && (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Attached to</p>
                <Tabs
                  value={target}
                  onValueChange={(v) => {
                    setTarget(v as typeof target);
                    setTargetId(null);
                  }}
                >
                  <TabsList>
                    <TabsTrigger value="crisis_note">Crisis note</TabsTrigger>
                    <TabsTrigger value="directive">Directive</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {target === "crisis_note" ? (
                crisisNotes?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No crisis notes logged{activePeriod ? ` in ${activePeriod.name}` : ""} yet.
                  </p>
                ) : (
                  <FieldSelect
                    value={targetId}
                    placeholder="Select a crisis note…"
                    options={(crisisNotes ?? []).map((n) => ({
                      value: n.id,
                      label: `${n.title} — ${n.character.name}`,
                    }))}
                    onChange={setTargetId}
                  />
                )
              ) : directives?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No directives yet.</p>
              ) : (
                <FieldSelect
                  value={targetId}
                  placeholder="Select a directive…"
                  options={(directives ?? []).map((n) => ({
                    value: n.id,
                    label: `${n.title} (${NOTE_TYPE_LABEL[n.note_type]})`,
                  }))}
                  onChange={setTargetId}
                />
              )}
            </div>
          )}

          <ReasonField
            value={reason}
            onChange={setReason}
            required={props.mode === "revoke"}
            placeholder={
              props.mode === "transfer"
                ? "e.g. Traded for support on the opera house"
                : props.mode === "spend"
                  ? "e.g. Donated to Currie's petition"
                  : "e.g. Issued to the wrong delegate"
            }
          />
          <DialogFooter>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? "Saving…" : copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
