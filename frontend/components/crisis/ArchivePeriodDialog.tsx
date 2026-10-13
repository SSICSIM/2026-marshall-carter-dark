"use client";

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
import { useArchivePeriod } from "@/hooks/useCrisisPeriods";
import { useNetWorths } from "@/hooks/useMechanics";

interface Props {
  periodId: number;
  periodName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchivePeriodDialog({ periodId, periodName, open, onOpenChange }: Props) {
  const { mutate, isPending } = useArchivePeriod();
  const { data: delegates } = useNetWorths();
  const locked = delegates?.filter((d) => d.skip_fluctuation).length ?? 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End &ldquo;{periodName}&rdquo; and run the crisis update?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <ul className="list-disc space-y-1 pl-5">
              <li>Crisis notes, directives and net worth history for this update move to the archive.</li>
              <li>
                Every delegate&apos;s net worth moves randomly by up to ±3%, except the {locked}{" "}
                locked delegate{locked === 1 ? "" : "s"} edited manually this update.
              </li>
              <li>Change columns reset, and the next update starts right away.</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => mutate(periodId, { onSuccess: () => onOpenChange(false) })}
          >
            {isPending ? "Running…" : "Run Crisis Update"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
