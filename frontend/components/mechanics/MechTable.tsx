import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

/**
 * Compact table for the mechanics pages: muted headers, roomy rows,
 * designed to sit inside a card (no border after the last row).
 */
export function MechTable<T>(props: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  empty?: string;
  className?: string;
}) {
  return (
    <Table className={props.className}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {props.columns.map((c) => (
            <TableHead
              key={c.header}
              className={cn("h-auto px-3 py-2.5 text-xs font-medium text-muted-foreground", c.className)}
            >
              {c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.rows?.length ? (
          props.rows.map((row) => (
            <TableRow key={props.rowKey(row)}>
              {props.columns.map((c) => (
                <TableCell key={c.header} className={cn("px-3 py-2.5", c.className)}>
                  {c.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={props.columns.length}
              className="px-3 py-8 text-center text-muted-foreground"
            >
              {props.rows ? (props.empty ?? "Nothing here yet.") : "Loading…"}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/** Text-style row action ("View →", "Assign", "Unassign"). */
export function RowAction(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "cursor-pointer text-sm font-medium text-primary hover:underline disabled:opacity-50",
        props.className
      )}
    />
  );
}
