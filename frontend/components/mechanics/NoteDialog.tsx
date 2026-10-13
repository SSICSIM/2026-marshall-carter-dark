"use client";

import { useEffect, useState } from "react";
import { Plus, Stamp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateDelegateNote, useSealHoldings } from "@/hooks/useMechanics";
import type { CharacterResponse, DelegateNoteType } from "@/types/api";
import { NOTE_TYPE_LABEL } from "./format";
import { DelegateMultiSelect, FieldSelect } from "./pickers";

const TYPE_OPTIONS = (Object.keys(NOTE_TYPE_LABEL) as DelegateNoteType[]).map((t) => ({
  value: t,
  label: NOTE_TYPE_LABEL[t],
}));

interface SealRow {
  key: number;
  delegateId: number | null;
  quantity: string;
}
let nextKey = 0;

/**
 * New private or public directive. Can list several delegates, and carry wax
 * seals from any delegate — spent the moment the directive is saved.
 */
export function NewNoteDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegates: CharacterResponse[] | undefined;
  defaultDelegateId?: number;
}) {
  const [title, setTitle] = useState("");
  const [noteType, setNoteType] = useState<DelegateNoteType | null>("PRIVATE_DIRECTIVE");
  const [delegateIds, setDelegateIds] = useState<number[]>([]);
  const [contents, setContents] = useState("");
  const [sealRows, setSealRows] = useState<SealRow[]>([]);
  const { mutate, isPending } = useCreateDelegateNote();
  const { data: holdings } = useSealHoldings();

  useEffect(() => {
    if (props.open) {
      setTitle("");
      setNoteType("PRIVATE_DIRECTIVE");
      setDelegateIds(props.defaultDelegateId !== undefined ? [props.defaultDelegateId] : []);
      setContents("");
      setSealRows([]);
    }
  }, [props.open, props.defaultDelegateId]);

  const sealIds = sealRows.map((r) => r.delegateId);
  const sealsValid =
    new Set(sealIds).size === sealIds.length &&
    sealRows.every((r) => {
      const has = holdings?.find((d) => d.id === r.delegateId)?.seal_count ?? 0;
      const n = Number(r.quantity);
      return r.delegateId !== null && Number.isInteger(n) && n >= 1 && n <= has;
    });
  const isValid =
    !!title.trim() && !!noteType && delegateIds.length > 0 && !!contents.trim() && sealsValid;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    mutate(
      {
        title: title.trim(),
        note_type: noteType!,
        character_ids: delegateIds,
        contents,
        seals: sealRows.map((r) => ({ character_id: r.delegateId!, quantity: Number(r.quantity) })),
      },
      { onSuccess: () => props.onOpenChange(false) }
    );
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Directive</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              placeholder="e.g. Petition for a partnership seat"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="note-type">Type</Label>
              <FieldSelect
                id="note-type"
                value={noteType}
                placeholder="Select type…"
                options={TYPE_OPTIONS}
                onChange={setNoteType}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="note-delegates">Delegate(s)</Label>
              <DelegateMultiSelect
                id="note-delegates"
                delegates={props.delegates}
                value={delegateIds}
                onChange={setDelegateIds}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="note-contents">Contents</Label>
            <Textarea
              id="note-contents"
              placeholder="What the directive asks for, actions taken, staff response…"
              rows={5}
              value={contents}
              onChange={(e) => setContents(e.target.value)}
            />
          </div>
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Wax seals attached</p>
                <p className="text-xs text-muted-foreground">
                  Optional. Spent when the directive is saved; any delegate can donate theirs.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSealRows((rs) => [...rs, { key: nextKey++, delegateId: null, quantity: "1" }])
                }
              >
                <Plus /> Attach seals
              </Button>
            </div>
            {sealRows.map((row) => {
              const has = holdings?.find((d) => d.id === row.delegateId)?.seal_count;
              return (
                <div key={row.key} className="flex items-end gap-2">
                  <div className="flex-1">
                    <FieldSelect
                      value={row.delegateId}
                      placeholder="Whose seals…"
                      options={(holdings ?? [])
                        .filter((d) => d.seal_count > 0)
                        .map((d) => ({ value: d.id, label: `${d.name} (${d.seal_count})` }))}
                      onChange={(delegateId) =>
                        setSealRows((rs) =>
                          rs.map((r) => (r.key === row.key ? { ...r, delegateId } : r))
                        )
                      }
                    />
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={has}
                    aria-label="Seals"
                    className="w-20"
                    value={row.quantity}
                    onChange={(e) =>
                      setSealRows((rs) =>
                        rs.map((r) => (r.key === row.key ? { ...r, quantity: e.target.value } : r))
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove"
                    onClick={() => setSealRows((rs) => rs.filter((r) => r.key !== row.key))}
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
            {sealRows.length > 0 && !sealsValid && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <Stamp className="size-4" /> Check the seals: each delegate once, and no more than
                they hold.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? "Adding…" : "Add Directive"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
