import type { DelegateNetWorth, DelegateNoteType, NetWorthTransaction } from "@/types/api";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatMoney(value: number) {
  return money.format(value);
}

export function formatNumber(value: number) {
  return plain.format(value);
}

const sig3 = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 });
const sig3Fixed = new Intl.NumberFormat("en-US", {
  minimumSignificantDigits: 3,
  maximumSignificantDigits: 3,
});

/** Ascending units for compact money; the last one absorbs anything larger. */
const COMPACT_UNITS: [size: number, suffix: string][] = [
  [1_000_000, "M"],
  [1_000_000_000, "B"],
  [1_000_000_000_000, "T"],
  [1_000_000_000_000_000, "Q"],
];

/** "$1.41M", "$2.00B", "$3.50T", "$1.20Q", or "$123,000" — three significant figures. */
export function formatMoneyCompact(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  // Rounding can carry into the next unit (999,999 → 1.00M, 999.96M → 1.00B), so check after rounding.
  if (Number(abs.toPrecision(3)) < 1_000_000) return `${sign}$${sig3.format(abs)}`;
  const [size, suffix] =
    COMPACT_UNITS.find(([s]) => Number((abs / s).toPrecision(3)) < 1000) ??
    COMPACT_UNITS[COMPACT_UNITS.length - 1];
  return `${sign}$${sig3Fixed.format(abs / size)}${suffix}`;
}

/**
 * Table cells are nowrap; names over `max` characters opt back into wrapping onto multiple lines.
 * The max-w-[50ch] cap is what forces the wrap — without a width limit the cell just widens.
 */
export function longNameClass(name: string, max = 50) {
  return name.length > max ? "min-w-0 max-w-[50ch] whitespace-normal break-words" : undefined;
}

/** "+1,200", "-300", or "--" for no change — matches the design's Difference column. */
export function formatDiff(delta: number) {
  if (delta === 0) return "--";
  return `${delta > 0 ? "+" : "-"}${plain.format(Math.abs(delta))}`;
}

/** "+$1.20M", "-$300,000", or "--" for no change — signed version of formatMoneyCompact. */
export function formatDiffCompact(delta: number) {
  if (delta === 0) return "--";
  return `${delta > 0 ? "+" : "-"}${formatMoneyCompact(Math.abs(delta))}`;
}

export function formatPct(delta: number, base: number) {
  if (delta === 0 || base === 0) return "--";
  const pct = (delta / Math.abs(base)) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** Text color for a signed change: chart-2 (teal) up, destructive down. */
export function diffClass(delta: number) {
  if (delta > 0) return "text-chart-2";
  if (delta < 0) return "text-destructive";
  return "text-foreground";
}

export function difference(d: DelegateNetWorth) {
  return d.net_worth - d.baseline_net_worth;
}

/** Stock-style ticker symbol derived from a delegate's name, e.g. "Jane Doe" → "JD". */
export function tickerFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export const NOTE_TYPE_LABEL: Record<DelegateNoteType, string> = {
  PRIVATE_DIRECTIVE: "Private Directive",
  PUBLIC_DIRECTIVE: "Public Directive",
};

export function transactionLabel(txn: NetWorthTransaction) {
  switch (txn.kind) {
    case "TRANSFER":
      return "Transfer";
    case "FLUCTUATION":
      return "Crisis Update";
    default:
      return txn.entries.length > 1 ? "Bulk" : "Single Del";
  }
}

/** Splits a list into two halves for the side-by-side ticker tables. */
export function halves<T>(items: T[]): [T[], T[]] {
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}
