"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActivePeriod } from "@/hooks/useCrisisPeriods";
import { useNetWorths, useNetWorthTransactions } from "@/hooks/useMechanics";
import type { DelegateNetWorth } from "@/types/api";
import { Section, StatTile } from "./BackroomShell";
import {
  diffClass,
  difference,
  formatDiff,
  formatDiffCompact,
  formatMoneyCompact,
  formatNumber,
  formatPct,
  longNameClass,
  tickerFor,
} from "./format";
import { MechTable, type Column } from "./MechTable";
import { EditNetWorthDialog, TransferDialog } from "./NetWorthDialogs";
import { sortByChange, TransactionLog } from "./NetWorthViews";
import { DelegateJump, PeriodSelect, periodFilter, type PeriodChoice } from "./pickers";

export const delegateHref = (id: number) => `/backroom/delegates/${id}`;

export function TickerBadge(props: { name: string }) {
  return (
    <span className="inline-flex min-w-10 justify-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
      {tickerFor(props.name)}
    </span>
  );
}

const columns: Column<DelegateNetWorth>[] = [
  {
    header: "Delegate",
    cell: (d) => (
      <Link href={delegateHref(d.id)} className="flex items-center gap-2.5 font-medium hover:underline">
        <TickerBadge name={d.name} />
        <span className={longNameClass(d.name)}>{d.name}</span>
      </Link>
    ),
  },
  {
    header: "Net worth",
    cell: (d) => formatMoneyCompact(d.net_worth),
    className: "text-right tabular-nums",
  },
  {
    header: "Change since update",
    cell: (d) => <span className={diffClass(difference(d))}>{formatDiff(difference(d))}</span>,
    className: "text-right tabular-nums",
  },
  {
    header: "% since update",
    cell: (d) => (
      <span className={diffClass(difference(d))}>
        {formatPct(difference(d), d.baseline_net_worth)}
      </span>
    ),
    className: "text-right tabular-nums",
  },
  {
    header: "Next update",
    cell: (d) =>
      d.skip_fluctuation ? (
        <Badge variant="secondary" title="Edited manually — skips the next random fluctuation">
          Locked
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">±3% random</span>
      ),
  },
];

export function BackroomNetWorthPage() {
  const { data: delegates } = useNetWorths();
  const { data: activePeriod } = useActivePeriod();
  const [historyPeriod, setHistoryPeriod] = useState<PeriodChoice>("active");
  const { data: transactions } = useNetWorthTransactions(
    periodFilter(historyPeriod, activePeriod?.id)
  );
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const total = delegates?.reduce((s, d) => s + d.net_worth, 0) ?? 0;
  const byChange = delegates ? [...delegates].sort((a, b) => difference(b) - difference(a)) : [];
  const gainer = byChange.find((d) => difference(d) > 0);
  const loser = [...byChange].reverse().find((d) => difference(d) < 0);
  const locked = delegates?.filter((d) => d.skip_fluctuation).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total net worth" value={formatMoneyCompact(total)} hint={`${delegates?.length ?? 0} delegates`} />
        <StatTile
          label="Top gainer"
          value={gainer ? <span className="text-chart-2">{formatDiffCompact(difference(gainer))}</span> : "—"}
          hint={gainer?.name}
        />
        <StatTile
          label="Top loser"
          value={loser ? <span className="text-destructive">{formatDiff(difference(loser))}</span> : "—"}
          hint={loser?.name}
        />
        <StatTile
          label="Locked for next update"
          value={formatNumber(locked)}
          hint="Manually edited — skip random fluctuation"
        />
      </div>

      <Section
        title="Delegates"
        description="Sorted by biggest change since the last crisis update."
        actions={
          <>
            <DelegateJump delegates={delegates} hrefFor={delegateHref} />
            <Button variant="outline" onClick={() => setTransferOpen(true)}>
              <ArrowLeftRight /> Transfer
            </Button>
            <Button onClick={() => setEditOpen(true)}>
              <Pencil /> Edit Net Worth
            </Button>
          </>
        }
      >
        <MechTable
          columns={columns}
          rows={delegates && sortByChange(delegates)}
          rowKey={(d) => d.id}
          empty="No delegates yet — add them with the Characters button."
        />
      </Section>

      <Section
        title="History"
        description="Every net worth change, newest first. Each crisis update's market movement opens the next update."
        actions={<PeriodSelect value={historyPeriod} onChange={setHistoryPeriod} />}
      >
        <TransactionLog transactions={transactions} />
      </Section>

      <EditNetWorthDialog open={editOpen} onOpenChange={setEditOpen} delegates={delegates} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} delegates={delegates} />

    </div>
  );
}
