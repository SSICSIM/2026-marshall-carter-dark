"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePeriods } from "@/hooks/useCrisisPeriods";
import type { CharacterResponse } from "@/types/api";

/** "Jump to delegate…" select that navigates to that delegate's page. */
export function DelegateJump(props: {
  delegates: { id: number; name: string }[] | undefined;
  currentId?: number | null;
  hrefFor: (id: number) => string;
}) {
  const router = useRouter();
  return (
    <Select
      value={props.currentId ? String(props.currentId) : ""}
      onValueChange={(v) => router.push(props.hrefFor(Number(v)))}
    >
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Jump to delegate…" />
      </SelectTrigger>
      <SelectContent>
        {props.delegates?.map((d) => (
          <SelectItem key={d.id} value={String(d.id)}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Full-width single-choice select for dialogs. Values are numbers or strings. */
export function FieldSelect<T extends string | number>(props: {
  id?: string;
  value: T | null;
  options: { value: T; label: string }[];
  placeholder: string;
  onChange: (value: T) => void;
}) {
  return (
    <Select
      value={props.value === null ? "" : String(props.value)}
      onValueChange={(v) => {
        const match = props.options.find((o) => String(o.value) === v);
        if (match) props.onChange(match.value);
      }}
    >
      <SelectTrigger id={props.id} className="w-full">
        <SelectValue placeholder={props.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {props.options.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Multi-choice delegate dropdown, for directives that involve several delegates. */
export function DelegateMultiSelect(props: {
  id?: string;
  delegates: CharacterResponse[] | undefined;
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const names = props.delegates?.filter((d) => props.value.includes(d.id)).map((d) => d.name);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id={props.id}
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
        >
          <span className={names?.length ? "truncate" : "truncate text-muted-foreground"}>
            {names?.length ? names.join(", ") : "Select delegate(s)…"}
          </span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72">
        {props.delegates?.map((d) => (
          <DropdownMenuCheckboxItem
            key={d.id}
            checked={props.value.includes(d.id)}
            // Keep the menu open so several delegates can be ticked in one go.
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) =>
              props.onChange(
                checked ? [...props.value, d.id] : props.value.filter((id) => id !== d.id)
              )
            }
          >
            {d.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Which crisis update(s) to show: the current one, every one, or one by id. */
export type PeriodChoice = "active" | "all" | number;

/** Query filter for a PeriodChoice. Falls back to everything when no update is running. */
export function periodFilter(choice: PeriodChoice, activePeriodId: number | undefined) {
  if (choice === "all") return {};
  if (choice === "active") return activePeriodId !== undefined ? { period_id: activePeriodId } : {};
  return { period_id: choice };
}

/** "This update / Update 2 / Update 1 / All updates" select, newest first. */
export function PeriodSelect(props: { value: PeriodChoice; onChange: (value: PeriodChoice) => void }) {
  const { data: periods } = usePeriods();
  return (
    <Select
      value={String(props.value)}
      onValueChange={(v) => props.onChange(v === "active" || v === "all" ? v : Number(v))}
    >
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">This update</SelectItem>
        {periods
          ?.filter((p) => !p.is_active)
          .map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name}
            </SelectItem>
          ))}
        <SelectItem value="all">All updates</SelectItem>
      </SelectContent>
    </Select>
  );
}
