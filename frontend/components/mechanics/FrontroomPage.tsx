"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";

import { useNetWorthHistory, useNetWorths } from "@/hooks/useMechanics";
import { cn } from "@/lib/utils";
import type { DelegateNetWorth } from "@/types/api";
import {
  difference,
  formatMoneyCompact,
  formatNumber,
  formatPct,
  halves,
  tickerFor,
} from "./format";
import { NetWorthChart, sortByChange, toneOf } from "./NetWorthViews";

const frontroomHref = (id: number | null) => (id === null ? "/frontroom" : `/frontroom?delegate=${id}`);

/** Ink tone on paper and white cards. */
const inkTone = (delta: number) =>
  delta > 0 ? "text-ink-up" : delta < 0 ? "text-ink-down" : "text-[var(--ink)]";
const arrow = (delta: number) => (delta > 0 ? "▲" : delta < 0 ? "▼" : "–");

function signed(delta: number, format: (value: number) => string = formatNumber) {
  if (delta === 0) return "UNCH";
  return `${delta > 0 ? "+" : "−"}${format(Math.abs(delta))}`;
}

/** Unsigned percent change; direction is carried by the arrow. */
const pct = (d: DelegateNetWorth) =>
  formatPct(difference(d), d.baseline_net_worth).replace("--", "0.0%").replace(/^[+-]/, "");

/**
 * Delegate-facing quotation room for the 1882 London office, styled after
 * the old NYSE quotation boards.
 * ``?delegate=<id>`` posts one delegate's quote + chart; otherwise the full
 * quotation board. The selection lives in the URL so the projector survives
 * a reload.
 */
export function FrontroomPage() {
  const params = useSearchParams();
  const raw = params.get("delegate");
  const delegateId = raw ? Number(raw) : null;
  const { data: delegates } = useNetWorths({ poll: true });
  const delegate = delegates?.find((d) => d.id === delegateId);

  return (
    <div className="flex min-h-screen flex-col gap-8 pb-10">
      <Nameplate />
      <main className="flex-1 px-6 lg:px-12">
        {delegateId === null ? (
          <QuotationBoard delegates={delegates} />
        ) : delegate ? (
          <SingleQuote delegate={delegate} />
        ) : (
          <Board>
            <p className="text-3xl tracking-wide uppercase">
              {delegates ? "No such listing" : "Awaiting the wire…"}
            </p>
          </Board>
        )}
      </main>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{now ? format(now, "h:mm:ss a") : "–:––"}</span>;
}

/** Brass nameplate across the top: firm name and clock. */
function Nameplate() {
  return (
    <header className="grid items-center gap-4 px-6 pt-6 lg:grid-cols-[1fr_auto_1fr] lg:px-12">
      {/* Empty left cell keeps the nameplate centred. */}
      <div className="hidden lg:block" />
      <Link href="/frontroom" className="brass-plate font-plaque rounded-sm px-10 py-3 text-center">
        <p className="text-2xl font-extrabold tracking-[0.1em] uppercase md:text-3xl">
          Marshall, Carter &amp; Dark
        </p>
        <p className="text-xs font-semibold tracking-[0.2em] uppercase">London Office · Est. 1403</p>
      </Link>
      <div className="text-right text-[var(--paper)] lg:justify-self-end">
        <p className="text-xs tracking-wide text-[var(--brass)] uppercase">Floor Time</p>
        <p className="text-3xl font-medium">
          <Clock />
        </p>
        <Link
          href="/backroom/net-worth"
          className="text-xs tracking-wider text-[var(--board-dim)] uppercase opacity-60 hover:opacity-100"
        >
          Backroom →
        </Link>
      </div>
    </header>
  );
}

function Board(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("quote-board px-5 py-6 md:px-8", props.className)}>{props.children}</div>
  );
}

/** Increments whenever ``value`` changes, to re-key (and re-flip) its cards. */
function useSwapCount(value: number) {
  const prev = useRef(value);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (value !== prev.current) {
      prev.current = value;
      setN((x) => x + 1);
    }
  }, [value]);
  return n;
}

/** A white price card hung in the board. Flips in whenever ``swap`` changes. */
function Placard(props: { children: React.ReactNode; swap?: number; className?: string }) {
  return (
    <span
      key={props.swap}
      className={cn("placard", props.swap ? "card-swap" : undefined, props.className)}
    >
      {props.children}
    </span>
  );
}

const ROW_GRID =
  "grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(9rem,auto)_9rem_7rem] items-center gap-3 whitespace-nowrap";

function QuoteRow(props: { d: DelegateNetWorth }) {
  const { d } = props;
  const diff = difference(d);
  const swap = useSwapCount(d.net_worth);
  return (
    <Link
      href={frontroomHref(d.id)}
      className={cn(
        ROW_GRID,
        "rounded-sm px-2 py-2 text-2xl transition-colors hover:bg-white/5 md:text-3xl"
      )}
    >
      <span className="font-bold tracking-wider">{tickerFor(d.name)}</span>
      <span className="truncate text-lg tracking-wider text-[var(--board-dim)] uppercase md:text-xl">
        {d.name}
      </span>
      <Placard swap={swap} className="justify-self-end font-semibold">
        {formatNumber(d.net_worth)}
      </Placard>
      <Placard swap={swap} className={cn("justify-self-end", inkTone(diff))}>
        {signed(diff, formatMoneyCompact)}
      </Placard>
      <Placard swap={swap} className={cn("justify-self-end", inkTone(diff))}>
        {arrow(diff)} {pct(d)}
      </Placard>
    </Link>
  );
}

function QuoteColumn(props: { rows: DelegateNetWorth[] }) {
  return (
    <div className="min-w-0 space-y-1">
      <div
        className={cn(
          ROW_GRID,
          "border-b border-[var(--border)] px-2 pb-1.5 text-sm tracking-wide text-[var(--board-dim)] uppercase"
        )}
      >
        <span>Sym.</span>
        <span>Character</span>
        <span className="text-right">Last</span>
        <span className="text-right">Chg.</span>
        <span className="text-right">%</span>
      </div>
      {props.rows.map((d) => (
        <QuoteRow key={d.id} d={d} />
      ))}
    </div>
  );
}

function MoverSlip(props: { label: string; d: DelegateNetWorth | undefined }) {
  const diff = props.d ? difference(props.d) : 0;
  return (
    <div className="paper-slip px-5 py-2.5 uppercase">
      <p className="text-xs tracking-wide opacity-70">{props.label}</p>
      {props.d ? (
        <Link href={frontroomHref(props.d.id)} className="flex items-baseline gap-3 text-3xl">
          <span className="font-bold">{tickerFor(props.d.name)}</span>
          <span className={cn("font-medium", inkTone(diff))}>
            {arrow(diff)} {pct(props.d)}
          </span>
        </Link>
      ) : (
        <p className="text-3xl opacity-50">—</p>
      )}
    </div>
  );
}

function QuotationBoard(props: { delegates: DelegateNetWorth[] | undefined }) {
  if (!props.delegates?.length) {
    return (
      <Board>
        <p className="text-3xl tracking-wide uppercase">
          {props.delegates ? "No listings yet" : "Awaiting the wire…"}
        </p>
      </Board>
    );
  }

  const sorted = sortByChange(props.delegates);
  const byChange = [...props.delegates].sort((a, b) => difference(b) - difference(a));
  const gainer = byChange.find((d) => difference(d) > 0);
  const loser = [...byChange].reverse().find((d) => difference(d) < 0);
  // Split into two columns only once a single column would scroll.
  const [left, right] = sorted.length > 8 ? halves(sorted) : [sorted, []];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-center gap-5">
        <MoverSlip label="Biggest Gain" d={gainer} />
        <MoverSlip label="Biggest Loss" d={loser} />
      </div>
      <Board>
        <h2 className="mb-5 text-center text-2xl font-semibold tracking-wide uppercase">
          Quotations
        </h2>
        <div className={cn("grid gap-x-14 gap-y-6", right.length > 0 && "xl:grid-cols-2")}>
          <QuoteColumn rows={left} />
          {right.length > 0 && <QuoteColumn rows={right} />}
        </div>
      </Board>
    </div>
  );
}

/** "$1,406,238" posted one card per digit; separators sit in the gaps. */
function DigitCards(props: { value: string; swap: number }) {
  return (
    <span className="inline-flex items-end gap-1.5">
      {[...props.value].map((ch, i) =>
        /\d/.test(ch) ? (
          <Placard key={i} swap={props.swap} className="w-[0.82em] px-0 font-semibold">
            {ch}
          </Placard>
        ) : (
          <span key={i} className="px-0.5 text-[var(--board-dim)]">
            {ch}
          </span>
        )
      )}
    </span>
  );
}

function StatSlip(props: { label: string; value: string }) {
  return (
    <div className="paper-slip min-w-36 px-5 py-2.5 uppercase">
      <p className="text-xs tracking-wide opacity-70">{props.label}</p>
      <p className="text-3xl">{props.value}</p>
    </div>
  );
}

function SingleQuote(props: { delegate: DelegateNetWorth }) {
  const d = props.delegate;
  const diff = difference(d);
  const swap = useSwapCount(d.net_worth);
  const { data: history } = useNetWorthHistory(d.id, { poll: true });
  const values = history?.map((p) => p.net_worth) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <Board className="space-y-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4 uppercase">
          <p className="flex items-baseline gap-4">
            <span className="text-5xl font-bold tracking-wider">{tickerFor(d.name)}</span>
            <span className="text-2xl tracking-wide text-[var(--board-dim)]">{d.name}</span>
          </p>
          <Link
            href="/frontroom"
            className="text-lg tracking-wide text-[var(--board-dim)] hover:text-[var(--board-text)]"
          >
            ← All quotations
          </Link>
        </div>
        <div className="space-y-5 text-center">
          <p className="text-6xl md:text-8xl xl:text-9xl">
            <DigitCards value={formatMoneyCompact(d.net_worth)} swap={swap} />
          </p>
          <p className="flex justify-center gap-3 text-3xl md:text-5xl">
            <Placard swap={swap} className={inkTone(diff)}>
              {arrow(diff)} {signed(diff)}
            </Placard>
            <Placard swap={swap} className={inkTone(diff)}>
              {pct(d)}
            </Placard>
          </p>
        </div>
        <NetWorthChart
          characterId={d.id}
          poll
          tone={toneOf(diff)}
          className="h-[320px] w-full text-sm"
        />
      </Board>

      <div className="flex flex-wrap justify-center gap-5">
        <StatSlip label="Open" value={formatMoneyCompact(d.baseline_net_worth)} />
        <StatSlip
          label="High"
          value={values.length ? formatMoneyCompact(Math.max(...values)) : "—"}
        />
        <StatSlip label="Low" value={values.length ? formatMoneyCompact(Math.min(...values)) : "—"} />
        <StatSlip label="Trades" value={history ? String(Math.max(history.length - 1, 0)) : "—"} />
      </div>
    </div>
  );
}
