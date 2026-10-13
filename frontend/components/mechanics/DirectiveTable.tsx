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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DelegateNoteResponse } from "@/types/api";

/** Directives laid out like the Crisis Tracker's note table. */
export function DirectiveTable(props: {
  directives: DelegateNoteResponse[];
  readOnly?: boolean;
  onDelete?: (id: number) => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

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
              <TableHead className="text-right">Seals</TableHead>
              <TableHead className="text-right">Created</TableHead>
              {!props.readOnly && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.directives.map((d) => (
              <TableRow key={d.id}>
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
                      onClick={() => setDeleteTarget(d.id)}
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
