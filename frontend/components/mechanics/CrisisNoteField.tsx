"use client";

import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useActivePeriod } from "@/hooks/useCrisisPeriods";
import { useNotes } from "@/hooks/useCrisisNotes";
import type { CrisisNoteCreate, NoteType, Priority } from "@/types/api";
import { FieldSelect } from "./pickers";

/** Form state for the crisis note that must justify every manual money change. */
export interface CrisisNoteChoice {
  mode: "new" | "existing";
  noteId: number | null;
  title: string;
  description: string;
  priority: Priority | null;
  noteType: NoteType | null;
  characterId: number | null;
}

export const EMPTY_NOTE_CHOICE: CrisisNoteChoice = {
  mode: "new",
  noteId: null,
  title: "",
  description: "",
  priority: "MEDIUM",
  noteType: "PRIVATE_DIRECTIVE",
  characterId: null,
};

export function isNoteChoiceValid(c: CrisisNoteChoice, activePeriodId: number | undefined) {
  if (c.mode === "existing") return c.noteId !== null;
  return (
    activePeriodId !== undefined &&
    !!c.title.trim() &&
    !!c.description.trim() &&
    !!c.priority &&
    !!c.noteType &&
    c.characterId !== null
  );
}

/** The crisis-note half of a net worth transaction request body. */
export function notePayload(
  c: CrisisNoteChoice,
  activePeriodId: number | undefined
): { crisis_note_id: number } | { crisis_note: CrisisNoteCreate } {
  if (c.mode === "existing") return { crisis_note_id: c.noteId! };
  return {
    crisis_note: {
      character_id: c.characterId!,
      period_id: activePeriodId,
      title: c.title.trim(),
      description: c.description.trim(),
      priority: c.priority!,
      note_type: c.noteType!,
    },
  };
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];
const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: "PRIVATE_DIRECTIVE", label: "Private Directive" },
  { value: "PUBLIC_DIRECTIVE", label: "Public Directive" },
];

/**
 * Required crisis note for a transfer/edit: write a new one (filed in the
 * active period) or link one already logged in the Crisis Tracker.
 */
export function CrisisNoteField(props: {
  value: CrisisNoteChoice;
  onChange: (patch: Partial<CrisisNoteChoice>) => void;
  /** Delegates involved in the change; a new note is filed under one of them. */
  involved: { id: number; name: string }[];
}) {
  const { data: activePeriod, isLoading: periodLoading } = useActivePeriod();
  const { data: notes } = useNotes(
    activePeriod ? { period_id: activePeriod.id } : {},
    !periodLoading
  );
  const c = props.value;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Crisis note</p>
          <p className="text-xs text-muted-foreground">Required — explains why the money moved.</p>
        </div>
        <Tabs
          value={c.mode}
          onValueChange={(v) => props.onChange({ mode: v as CrisisNoteChoice["mode"] })}
        >
          <TabsList>
            <TabsTrigger value="new">Write new</TabsTrigger>
            <TabsTrigger value="existing">Use existing</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {c.mode === "existing" ? (
        <div className="space-y-1">
          <Label htmlFor="cn-existing">
            Note{activePeriod ? ` from ${activePeriod.name}` : ""}
          </Label>
          {notes?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No crisis notes logged{activePeriod ? " this period" : ""} yet — write a new one.
            </p>
          ) : (
            <FieldSelect
              id="cn-existing"
              value={c.noteId}
              placeholder="Select a crisis note…"
              options={(notes ?? []).map((n) => ({
                value: n.id,
                label: `${n.title} — ${n.character.name}`,
              }))}
              onChange={(noteId) => props.onChange({ noteId })}
            />
          )}
        </div>
      ) : !periodLoading && !activePeriod ? (
        <p className="text-sm text-muted-foreground">
          There&apos;s no active crisis period, so new notes can&apos;t be filed.{" "}
          <Link href="/tracker" className="font-medium text-primary hover:underline">
            Start one in the Crisis Tracker
          </Link>{" "}
          or link an existing note.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cn-title">Title</Label>
            <Input
              id="cn-title"
              placeholder="e.g. Buys the Pittsburgh steel mill"
              value={c.title}
              onChange={(e) => props.onChange({ title: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cn-description">What happened</Label>
            <Textarea
              id="cn-description"
              rows={3}
              placeholder="The directive or action that caused this change…"
              value={c.description}
              onChange={(e) => props.onChange({ description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="cn-character">Filed under</Label>
              <FieldSelect
                id="cn-character"
                value={c.characterId}
                placeholder="Delegate…"
                options={props.involved.map((d) => ({ value: d.id, label: d.name }))}
                onChange={(characterId) => props.onChange({ characterId })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cn-type">Type</Label>
              <FieldSelect
                id="cn-type"
                value={c.noteType}
                placeholder="Type…"
                options={NOTE_TYPES}
                onChange={(noteType) => props.onChange({ noteType })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cn-priority">Priority</Label>
              <FieldSelect
                id="cn-priority"
                value={c.priority}
                placeholder="Priority…"
                options={PRIORITIES}
                onChange={(priority) => props.onChange({ priority })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Files a new note under the first involved delegate unless staff picked another. */
export function withDefaultCharacter(
  c: CrisisNoteChoice,
  involved: { id: number }[]
): CrisisNoteChoice {
  if (c.characterId !== null && involved.some((d) => d.id === c.characterId)) return c;
  return { ...c, characterId: involved[0]?.id ?? null };
}
