"use client";

import { useEffect, useRef, useState } from "react";

import { NotesByCharacterChart } from "@/components/crisis/NotesByCharacterChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePeriods } from "@/hooks/useCrisisPeriods";
import { useDelegateNotes } from "@/hooks/useMechanics";
import type { DelegateNoteResponse } from "@/types/api";

// "__all__" sentinel means no period_id filter (aggregate across all updates)
const ALL_PERIODS = "__all__";

/** Directive counts per update, laid out like the Crisis Tracker's Analytics tab. */
export function DirectiveAnalyticsTab(props: { defaultPeriodId: number | null }) {
  const { data: periods, isLoading: loadingPeriods } = usePeriods();
  const [selected, setSelected] = useState<string>(ALL_PERIODS);

  // Auto-select the current update once it loads, until the user picks one.
  const userPickedRef = useRef(false);
  useEffect(() => {
    if (!userPickedRef.current && props.defaultPeriodId) {
      setSelected(String(props.defaultPeriodId));
    }
  }, [props.defaultPeriodId]);

  const { data: directives, isLoading } = useDelegateNotes(
    selected === ALL_PERIODS ? {} : { period_id: Number(selected) }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium">Update</p>
        {loadingPeriods ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <Select
            value={selected}
            onValueChange={(v) => {
              userPickedRef.current = true;
              setSelected(v);
            }}
          >
            <SelectTrigger className="h-8 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PERIODS}>All updates</SelectItem>
              {periods?.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}{" "}
                  {p.is_active && <span className="text-muted-foreground text-xs">(current)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading || !directives ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <DirectiveStatCards directives={directives} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <NotesByCharacterChart
              title="Directives by Delegate"
              label="Directives"
              data={countBy(directives, () => 1)}
            />
            <NotesByCharacterChart
              title="Seals Attached by Delegate"
              label="Seals"
              data={countBy(directives, (d) => d.seals)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Per-delegate totals, biggest first. A joint directive counts for every
 * delegate on it, so the bars can add up to more than the directive total.
 */
function countBy(directives: DelegateNoteResponse[], value: (d: DelegateNoteResponse) => number) {
  const totals = new Map<string, number>();
  for (const d of directives) {
    for (const c of d.characters) totals.set(c.name, (totals.get(c.name) ?? 0) + value(d));
  }
  return [...totals]
    .filter(([, count]) => count > 0)
    .map(([character_name, count]) => ({ character_name, count }))
    .sort((a, b) => b.count - a.count || a.character_name.localeCompare(b.character_name));
}

function DirectiveStatCards(props: { directives: DelegateNoteResponse[] }) {
  const ds = props.directives;
  const stats = [
    { label: "Total Directives", value: ds.length },
    { label: "Private Directives", value: ds.filter((d) => d.note_type === "PRIVATE_DIRECTIVE").length },
    { label: "Public Directives", value: ds.filter((d) => d.note_type === "PUBLIC_DIRECTIVE").length },
    { label: "Seals Attached", value: ds.reduce((sum, d) => sum + d.seals, 0) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {s.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold">{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
