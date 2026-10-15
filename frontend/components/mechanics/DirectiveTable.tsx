"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { NoteTypeBadge } from "@/components/crisis/NoteTypeBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePeriods } from "@/hooks/useCrisisPeriods";
import type { DelegateNoteResponse } from "@/types/api";

/** Directives laid out like the Crisis Tracker's note table. Click a row for full details. */
export function DirectiveTable(props: {
  directives: DelegateNoteResponse[];
  readOnly?: boolean;
  onDelete?: (id: number) => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [selected, setSelected] = useState<DelegateNoteResponse | null>(null);
  const { data: periods } = usePeriods();
  const periodName = (id: number | null) =>
    id === null ? null : (periods?.find((p) => p.id === id)?.name ?? null);

  if (props.directives.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">No directives yet.</p>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Delegate(s)</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Crisis Period</TableHead>
              <TableHead className="text-right">Seals</TableHead>
              <TableHead className="text-right">Created</TableHead>
              {!props.readOnly && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.directives.map((d) => (
              <TableRow
                key={d.id}
                className="cursor-pointer"
                onClick={() => setSelected(d)}
              >
                <TableCell className="max-w-48 font-medium whitespace-normal">
                  {d.characters.map((c) => c.name).join(", ")}
                </TableCell>
                <TableCell className="max-w-64">
                  <p className="truncate font-medium">{d.title}</p>
                  <p className="text-muted-foreground truncate text-xs" title={d.contents}>
                    {d.contents}
                  </p>
                </TableCell>
                <TableCell>
                  <NoteTypeBadge noteType={d.note_type} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {periodName(d.period_id) ?? <span className="text-muted-foreground/40 text-xs">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {d.seals ? d.seals : <span className="text-muted-foreground/40 text-xs">—</span>}
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-xs whitespace-nowrap">
                  {new Date(d.created_at).toLocaleString()}
                </TableCell>
                {!props.readOnly && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:text-destructive"
                      aria-label="Delete directive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(d.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>
                  <NoteTypeBadge noteType={selected.note_type} />
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Delegate(s)</dt>
                <dd>{selected.characters.map((c) => c.name).join(", ") || "—"}</dd>
                <dt className="text-muted-foreground">Crisis period</dt>
                <dd>{periodName(selected.period_id) ?? "—"}</dd>
                <dt className="text-muted-foreground">Seals</dt>
                <dd className="tabular-nums">{selected.seals || "—"}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{new Date(selected.created_at).toLocaleString()}</dd>
              </dl>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium uppercase">Contents</p>
                <p className="text-sm whitespace-pre-wrap">{selected.contents || "—"}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this directive?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Seals spent on it are not refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget !== null) props.onDelete?.(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
