"use client";

import Link from "next/link";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import type { DelegateNoteResponse, DelegateSeals, SealAction, SealMovement } from "@/types/api";
import { longNameClass, NOTE_TYPE_LABEL } from "./format";
import { MechTable, RowAction, type Column } from "./MechTable";
import type { SealActionMode } from "./SealDialogs";

/** Delegate / Seals held / row actions. */
export function SealHoldingsTable(props: {
  holdings: DelegateSeals[] | undefined;
  onAction: (mode: SealActionMode | "issue", delegateId: number) => void;
}) {
  const columns: Column<DelegateSeals>[] = [
    {
      header: "Delegate",
      cell: (d) => (
        <Link href={`/backroom/delegates/${d.id}`} className="font-medium hover:underline">
          <span className={longNameClass(d.name)}>{d.name}</span>
        </Link>
      ),
    },
    {
      header: "Seals held",
      cell: (d) => (
        <span className={d.seal_count === 0 ? "text-muted-foreground" : "font-semibold"}>
          {d.seal_count}
        </span>
      ),
      className: "w-28 text-right tabular-nums",
    },
    {
      header: "",
      cell: (d) => (
        <span className="flex justify-end gap-4">
          <RowAction onClick={() => props.onAction("issue", d.id)}>Issue</RowAction>
          <RowAction disabled={!d.seal_count} onClick={() => props.onAction("transfer", d.id)}>
            Transfer
          </RowAction>
          <RowAction disabled={!d.seal_count} onClick={() => props.onAction("spend", d.id)}>
            Spend
          </RowAction>
          <RowAction disabled={!d.seal_count} onClick={() => props.onAction("revoke", d.id)}>
            Revoke
          </RowAction>
        </span>
      ),
      className: "text-right",
    },
  ];
  return (
    <MechTable
      columns={columns}
      rows={props.holdings}
      rowKey={(d) => d.id}
      empty="No delegates yet — add them with the Characters button."
    />
  );
}

const ACTION_LABEL: Record<SealAction, string> = {
  ISSUED: "Issued",
  TRANSFERRED: "Transferred",
  SPENT: "Spent",
  REVOKED: "Revoked",
};

const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;

/** The wax seal ledger: every issue, transfer, spend and revoke. */
export function SealMovementLog(props: { movements: SealMovement[] | undefined }) {
  const columns: Column<SealMovement>[] = [
    {
      header: "Time",
      cell: (m) => format(new Date(m.created_at), "MMM d, HH:mm"),
      className: "w-32 text-muted-foreground",
    },
    {
      header: "Action",
      cell: (m) => (
        <Badge variant={m.action === "SPENT" ? "default" : "outline"}>{ACTION_LABEL[m.action]}</Badge>
      ),
      className: "w-28",
    },
    { header: "Seals", cell: (m) => m.quantity, className: "w-16 text-right tabular-nums" },
    {
      header: "From",
      cell: (m) => m.from_character?.name ?? muted(m.action === "ISSUED" ? "Crisis staff" : "—"),
    },
    {
      header: "To / attached to",
      cell: (m) => {
        if (m.to_character) return m.to_character.name;
        if (m.crisis_note) return <>Crisis note: {m.crisis_note.title}</>;
        if (m.directive) return <>Directive: {m.directive.title}</>;
        return muted(m.action === "REVOKED" ? "Crisis staff" : "—");
      },
      className: "whitespace-normal",
    },
    {
      header: "Reason",
      cell: (m) => m.reason ?? muted("—"),
      className: "whitespace-normal",
    },
  ];
  return (
    <MechTable
      columns={columns}
      rows={props.movements}
      rowKey={(m) => m.id}
      empty="No seal activity yet."
    />
  );
}

/** Title / Type / (Delegate(s)) / Seals / Contents table for directives. */
export function NotesTable(props: {
  notes: DelegateNoteResponse[] | undefined;
  showDelegates?: boolean;
}) {
  const columns: Column<DelegateNoteResponse>[] = [
    { header: "Title", cell: (n) => n.title, className: "w-48 font-medium whitespace-normal" },
    {
      header: "Type",
      cell: (n) => <Badge variant="outline">{NOTE_TYPE_LABEL[n.note_type]}</Badge>,
      className: "w-36",
    },
    ...(props.showDelegates
      ? [
          {
            header: "Delegate(s)",
            cell: (n: DelegateNoteResponse) => n.characters.map((c) => c.name).join(", "),
            className: "w-56 whitespace-normal",
          },
        ]
      : []),
    {
      header: "Seals",
      cell: (n) => (n.seals ? n.seals : muted("—")),
      className: "w-16 text-right tabular-nums",
    },
    { header: "Contents", cell: (n) => n.contents, className: "whitespace-pre-wrap" },
  ];
  return <MechTable columns={columns} rows={props.notes} rowKey={(n) => n.id} empty="No directives yet." />;
}
