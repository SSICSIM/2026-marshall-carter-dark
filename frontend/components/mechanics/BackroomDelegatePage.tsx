"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, MonitorPlay, Pencil, Plus, Stamp, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCharacters } from "@/hooks/useCharacters";
import {
  useDelegateNotes,
  useNetWorths,
  useNetWorthTransactions,
  useSealHoldings,
  useSealMovements,
} from "@/hooks/useMechanics";
import { delegateHref, TickerBadge } from "./BackroomNetWorthPage";
import { Section, StatTile } from "./BackroomShell";
import { diffClass, difference, formatDiff, formatMoneyCompact, formatPct } from "./format";
import { EditNetWorthDialog, TransferDialog } from "./NetWorthDialogs";
import { NetWorthChart, TransactionLog, toneOf } from "./NetWorthViews";
import { NewNoteDialog } from "./NoteDialog";
import { DelegateJump } from "./pickers";
import { IssueSealsDialog, SealActionDialog, type SealActionMode } from "./SealDialogs";
import { NotesTable, SealMovementLog } from "./SealAndNoteTables";

type DialogName =
  | "edit"
  | "transfer"
  | "note"
  | "seal-issue"
  | `seal-${SealActionMode}`
  | null;

/** Everything about one delegate: net worth + chart, history, directives, seals. */
export function BackroomDelegatePage(props: { delegateId: number }) {
  const id = props.delegateId;
  const [dialog, setDialog] = useState<DialogName>(null);
  const { data: delegates } = useNetWorths();
  const { data: characters } = useCharacters();
  const { data: transactions } = useNetWorthTransactions({ character_id: id });
  const { data: notes } = useDelegateNotes({ character_id: id });
  const { data: sealHoldings } = useSealHoldings();
  const { data: sealMovements } = useSealMovements({ character_id: id });
  const delegate = delegates?.find((d) => d.id === id);
  const sealCount = sealHoldings?.find((d) => d.id === id)?.seal_count;
  const diff = delegate ? difference(delegate) : 0;

  const close = (open: boolean) => !open && setDialog(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Back to net worth">
            <Link href="/backroom/net-worth">
              <ArrowLeft />
            </Link>
          </Button>
          {delegate && <TickerBadge name={delegate.name} />}
          <h2 className="text-xl font-semibold">{delegate?.name ?? "…"}</h2>
          {delegate?.skip_fluctuation && <Badge variant="secondary">Locked for next update</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DelegateJump delegates={delegates} currentId={id} hrefFor={delegateHref} />
          <Button variant="outline" asChild>
            <Link href={`/frontroom?delegate=${id}`} target="_blank">
              <MonitorPlay /> Show in Frontroom
            </Link>
          </Button>
        </div>
      </div>

      {!delegate ? (
        <p className="text-muted-foreground">{delegates ? "Delegate not found." : "Loading…"}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Net worth" value={formatMoneyCompact(delegate.net_worth)} />
            <StatTile
              label="Change this update"
              value={<span className={diffClass(diff)}>{formatDiff(diff)}</span>}
              hint={formatPct(diff, delegate.baseline_net_worth)}
            />
            <StatTile label="Wax seals" value={sealCount ?? "—"} />
            <StatTile label="Directives" value={notes?.length ?? "—"} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Section
              title="Net worth"
              className="lg:col-span-3"
              actions={
                <>
                  <Button variant="outline" size="sm" onClick={() => setDialog("transfer")}>
                    <ArrowLeftRight /> Transfer
                  </Button>
                  <Button size="sm" onClick={() => setDialog("edit")}>
                    <Pencil /> Edit
                  </Button>
                </>
              }
            >
              <div className="p-3">
                <NetWorthChart characterId={id} tone={toneOf(diff)} className="h-64 w-full" />
              </div>
            </Section>
            <Section title="Wax seals" className="lg:col-span-2">
              <div className="space-y-4 p-4">
                <p>
                  <span className="text-5xl font-bold tabular-nums">{sealCount ?? "—"}</span>{" "}
                  <span className="text-muted-foreground">seal{sealCount === 1 ? "" : "s"} held</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => setDialog("seal-issue")}>
                    <Plus /> Issue
                  </Button>
                  <Button variant="outline" disabled={!sealCount} onClick={() => setDialog("seal-transfer")}>
                    <ArrowLeftRight /> Transfer
                  </Button>
                  <Button variant="outline" disabled={!sealCount} onClick={() => setDialog("seal-spend")}>
                    <Stamp /> Spend
                  </Button>
                  <Button variant="outline" disabled={!sealCount} onClick={() => setDialog("seal-revoke")}>
                    <Undo2 /> Revoke
                  </Button>
                </div>
              </div>
            </Section>
          </div>

          <Section
            title="Directives"
            actions={
              <Button variant="outline" size="sm" onClick={() => setDialog("note")}>
                <Plus /> Add Directive
              </Button>
            }
          >
            <NotesTable notes={notes} />
          </Section>

          <Section
            title="Seal log"
            description="Seals this delegate was issued, transferred, spent or had revoked."
          >
            <SealMovementLog movements={sealMovements} />
          </Section>

          <Section title="Net worth history">
            <TransactionLog transactions={transactions} characterId={id} />
          </Section>
        </>
      )}

      <EditNetWorthDialog
        open={dialog === "edit"}
        onOpenChange={close}
        delegates={delegates}
        defaultDelegateId={id}
      />
      <TransferDialog
        open={dialog === "transfer"}
        onOpenChange={close}
        delegates={delegates}
        defaultDelegateId={id}
      />
      <IssueSealsDialog
        open={dialog === "seal-issue"}
        onOpenChange={close}
        delegates={sealHoldings}
        defaultDelegateId={id}
      />
      <SealActionDialog
        mode={
          dialog === "seal-spend" ? "spend" : dialog === "seal-revoke" ? "revoke" : "transfer"
        }
        open={dialog === "seal-transfer" || dialog === "seal-spend" || dialog === "seal-revoke"}
        onOpenChange={close}
        delegates={sealHoldings}
        defaultDelegateId={id}
      />
      <NewNoteDialog
        open={dialog === "note"}
        onOpenChange={close}
        delegates={characters}
        defaultDelegateId={id}
      />
    </div>
  );
}
