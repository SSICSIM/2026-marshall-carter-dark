"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { crisisPeriodsService } from "@/services/crisisPeriods";
import type { CrisisPeriodCreate } from "@/types/api";

export function usePeriods() {
  return useQuery({
    queryKey: ["periods"],
    queryFn: () => crisisPeriodsService.list(),
  });
}

export function useActivePeriod() {
  return useQuery({
    queryKey: ["periods", "active"],
    queryFn: () => crisisPeriodsService.getActive(),
    retry: false,
  });
}

export function useCreatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CrisisPeriodCreate) => crisisPeriodsService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["periods"] });
      toast.success("Period created.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create period."),
  });
}

export function useArchivePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => crisisPeriodsService.archive(id),
    onSuccess: (newPeriod) => {
      // Archiving is the crisis update: notes and directives move to the
      // archive, and net worth takes its market movement.
      qc.invalidateQueries({ queryKey: ["periods"] });
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["delegate-notes"] });
      qc.invalidateQueries({ queryKey: ["net-worth"] });
      toast.success(`Crisis update run. Now on ${newPeriod.name}.`);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to run crisis update."),
  });
}
