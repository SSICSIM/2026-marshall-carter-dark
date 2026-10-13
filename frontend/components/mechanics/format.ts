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

/** "+1,200", "-300", or "--" for no change — matches the design's Difference column. */
export function formatDiff(delta: number) {
  if (delta === 0) return "--";
  return `${delta > 0 ? "+" : "-"}${plain.format(Math.abs(delta))}`;
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
