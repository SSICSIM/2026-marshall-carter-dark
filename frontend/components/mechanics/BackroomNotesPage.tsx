"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCharacters } from "@/hooks/useCharacters";
import { useActivePeriod, usePeriods } from "@/hooks/useCrisisPeriods";
import { useDeleteDelegateNote, useDelegateNotes } from "@/hooks/useMechanics";
import type { DelegateNoteFilters, DelegateNoteType } from "@/types/api";
import { DirectiveAnalyticsTab } from "./DirectiveAnalyticsTab";
import { DirectiveTable } from "./DirectiveTable";
import { NewNoteDialog } from "./NoteDialog";

/** Directives, split like the Crisis Tracker: this update's, the archive, and analytics. */
export function BackroomNotesPage() {
  const { data: activePeriod } = useActivePeriod();
  return (
    <Tabs defaultValue="active" className="space-y-4">
      <TabsList>
        <TabsTrigger value="active">Active Directives</TabsTrigger>
        <TabsTrigger value="archive">Archive</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="mt-0">
        <ActiveDirectivesTab activePeriodId={activePeriod?.id ?? null} />
      </TabsContent>
      <TabsContent value="archive" className="mt-0">
        <ArchivedDirectivesTab />
      </TabsContent>
      <TabsContent value="analytics" className="mt-0">
        <DirectiveAnalyticsTab defaultPeriodId={activePeriod?.id ?? null} />
      </TabsContent>
    </Tabs>
  );
}

interface FilterState {
  q: string;
  character_id: string;
  note_type: string;
}
const NO_FILTERS: FilterState = { q: "", character_id: "", note_type: "" };

function toQuery(f: FilterState): DelegateNoteFilters {
  return {
    q: f.q || undefined,
    character_id: f.character_id ? Number(f.character_id) : undefined,
    note_type: (f.note_type as DelegateNoteType) || undefined,
  };
}

function ActiveDirectivesTab(props: { activePeriodId: number | null }) {
  const [newOpen, setNewOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS);
  const { data: delegates } = useCharacters();
  const { data: directives, isLoading } = useDelegateNotes(
    { period_id: props.activePeriodId ?? undefined, ...toQuery(filters) },
    props.activePeriodId !== null
  );
  const { mutate: deleteDirective } = useDeleteDelegateNote();

  if (props.activePeriodId === null) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        Start a crisis update above to begin logging directives.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DirectiveFilters filters={filters} onChange={setFilters} />
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Directive
        </Button>
      </div>
      <Results loading={isLoading}>
        <DirectiveTable directives={directives ?? []} onDelete={(id) => deleteDirective(id)} />
      </Results>
      <NewNoteDialog open={newOpen} onOpenChange={setNewOpen} delegates={delegates} />
    </div>
  );
}

function ArchivedDirectivesTab() {
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS);
  const [periodId, setPeriodId] = useState("");
  const { data: periods, isLoading: loadingPeriods } = usePeriods();
  const { data: directives, isLoading } = useDelegateNotes({
    ...(periodId ? { period_id: Number(periodId) } : { archived_only: true }),
    ...toQuery(filters),
  });

  return (
    <div className="space-y-4">
      <DirectiveFilters
        filters={filters}
        onChange={setFilters}
        extraActive={!!periodId}
        onClear={() => setPeriodId("")}
      >
        {loadingPeriods ? (
          <Skeleton className="h-8 w-44" />
        ) : (
          <Select
            value={periodId || "__all__"}
            onValueChange={(v) => setPeriodId(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="All updates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All past updates</SelectItem>
              {periods
                ?.filter((p) => !p.is_active)
                .map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </DirectiveFilters>
      <Results loading={isLoading}>
        <DirectiveTable directives={directives ?? []} readOnly />
      </Results>
    </div>
  );
}

function Results(props: { loading: boolean; children: React.ReactNode }) {
  if (!props.loading) return props.children;
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/** Search / delegate / type filters, matching the Crisis Tracker's note filters. */
function DirectiveFilters(props: {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  children?: React.ReactNode;
  extraActive?: boolean;
  onClear?: () => void;
}) {
  const { filters, onChange } = props;
  const { data: characters } = useCharacters();
  const [searchInput, setSearchInput] = useState(filters.q);

  // Debounce text search.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== filters.q) onChange({ ...filters, q: searchInput });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, filters, onChange]);

  const hasFilters =
    !!filters.q || !!filters.character_id || !!filters.note_type || !!props.extraActive;

  function clear() {
    setSearchInput("");
    onChange(NO_FILTERS);
    props.onClear?.();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search directives…"
        className="h-8 w-48"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />

      <Select
        value={filters.character_id || "__all__"}
        onValueChange={(v) => onChange({ ...filters, character_id: v === "__all__" ? "" : v })}
      >
        <SelectTrigger className="h-8 w-40">
          <SelectValue placeholder="All delegates" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All delegates</SelectItem>
          {characters?.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.note_type || "__all__"}
        onValueChange={(v) => onChange({ ...filters, note_type: v === "__all__" ? "" : v })}
      >
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All types</SelectItem>
          <SelectItem value="PRIVATE_DIRECTIVE">Private</SelectItem>
          <SelectItem value="PUBLIC_DIRECTIVE">Public</SelectItem>
        </SelectContent>
      </Select>

      {props.children}

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={clear}>
          <X className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
