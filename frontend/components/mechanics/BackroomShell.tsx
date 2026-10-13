"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MonitorPlay } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PeriodBanner } from "@/components/crisis/PeriodBanner";
import { cn } from "@/lib/utils";

const PAGES = [
  { href: "/backroom/net-worth", label: "Net Worth" },
  { href: "/backroom/seals", label: "Seals" },
  { href: "/backroom/directives", label: "Directives" },
];

/** Backroom chrome: title, section tabs, and a shortcut to the frontroom board. */
export function BackroomShell(props: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main className="page-shell space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Backroom</h1>
          <p className="text-sm text-muted-foreground">
            Manage net worth, seals and directives for Marshall, Carter &amp; Dark.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/frontroom" target="_blank">
            <MonitorPlay /> Open Frontroom
          </Link>
        </Button>
      </div>
      <PeriodBanner />
      <nav className="flex gap-1 border-b">
        {PAGES.map((page) => {
          const active = pathname.startsWith(page.href);
          return (
            <Link
              key={page.href}
              href={page.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {page.label}
            </Link>
          );
        })}
      </nav>
      {props.children}
    </main>
  );
}

/** A titled card section with optional actions on the right. */
export function Section(props: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card", props.className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{props.title}</h2>
          {props.description && (
            <p className="text-xs text-muted-foreground">{props.description}</p>
          )}
        </div>
        {props.actions && <div className="flex flex-wrap items-center gap-2">{props.actions}</div>}
      </div>
      <div className="px-1 pb-1">{props.children}</div>
    </section>
  );
}

export function StatTile(props: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {props.label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{props.value}</p>
      {props.hint && <p className="mt-0.5 text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  );
}
