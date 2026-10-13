"use client";

import { useId } from "react";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useNetWorthHistory } from "@/hooks/useMechanics";
import { cn } from "@/lib/utils";
import type { DelegateNetWorth, NetWorthTransaction } from "@/types/api";
import { diffClass, difference, formatDiff, formatMoney, transactionLabel } from "./format";
import { MechTable, type Column } from "./MechTable";

/** Biggest movers first (by absolute change since the last crisis update). */
export function sortByChange(delegates: DelegateNetWorth[]) {
  return [...delegates].sort(
    (a, b) => Math.abs(difference(b)) - Math.abs(difference(a)) || a.name.localeCompare(b.name)
  );
}

/** Ledger of net worth changes. ``characterId`` narrows Difference to one delegate. */
export function TransactionLog(props: {
  transactions: NetWorthTransaction[] | undefined;
  characterId?: number;
}) {
  const own = (t: NetWorthTransaction) =>
    t.entries.filter((e) => props.characterId === undefined || e.character_id === props.characterId);

  const columns: Column<NetWorthTransaction>[] = [
    {
      header: "Time",
      cell: (t) => format(new Date(t.created_at), "MMM d, HH:mm"),
      className: "w-32 text-muted-foreground",
    },
    { header: "Type", cell: transactionLabel, className: "w-28" },
    ...(props.characterId === undefined
      ? [
          {
            header: "Delegate(s)",
            cell: (t: NetWorthTransaction) =>
              t.entries.map((e) => e.character_name).join(", ") || "—",
            className: "whitespace-normal",
          },
        ]
      : []),
    {
      header: "Change",
      cell: (t) => {
        const entries = own(t);
        if (!entries.length) return <span className="text-muted-foreground">—</span>;
        return entries.map((e, i) => (
          <span key={e.character_id}>
            {i > 0 && ", "}
            <span className={diffClass(e.delta)}>{formatDiff(e.delta)}</span>
          </span>
        ));
      },
      className: "whitespace-normal tabular-nums",
    },
    {
      header: "Crisis note",
      cell: (t) =>
        t.crisis_note ? (
          <span>
            {t.crisis_note.title}
            {t.description !== t.crisis_note.title && (
              <span className="text-muted-foreground"> — {t.description}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">{t.description}</span>
        ),
      className: "whitespace-normal",
    },
  ];
  return (
    <MechTable
      columns={columns}
      rows={props.transactions}
      rowKey={(t) => t.id}
      empty="No net worth changes yet."
    />
  );
}

const TONE_COLOR = {
  up: "var(--up, var(--chart-2))",
  down: "var(--down, var(--destructive))",
  neutral: "var(--primary)",
} as const;

export type Tone = keyof typeof TONE_COLOR;

export function toneOf(delta: number): Tone {
  return delta > 0 ? "up" : delta < 0 ? "down" : "neutral";
}

/** One delegate's net worth after every recorded change, as a filled line. */
export function NetWorthChart(props: {
  characterId: number;
  poll?: boolean;
  tone?: Tone;
  className?: string;
}) {
  const gradientId = `nw-fill-${useId().replace(/:/g, "")}`;
  const { data } = useNetWorthHistory(props.characterId, { poll: props.poll });
  const points = data?.map((p, i) => ({
    step: i,
    label: format(new Date(p.at), "MMM d, HH:mm"),
    net_worth: p.net_worth,
  }));

  if (!points || points.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground",
          props.className
        )}
      >
        {points ? "Not enough history to chart yet." : "Loading…"}
      </div>
    );
  }

  const config: ChartConfig = {
    net_worth: { label: "Net worth", color: TONE_COLOR[props.tone ?? "neutral"] },
  };

  return (
    <ChartContainer config={config} className={cn("aspect-auto", props.className)}>
      <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-net_worth)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-net_worth)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={48} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) =>
            new Intl.NumberFormat("en-US", { notation: "compact" }).format(v)
          }
        />
        <ChartTooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-medium tabular-nums">{formatMoney(Number(value))}</span>
              )}
            />
          }
        />
        <Area
          dataKey="net_worth"
          type="linear"
          stroke="var(--color-net_worth)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
