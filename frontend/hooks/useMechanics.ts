"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  delegateNotesService,
  netWorthService,
  sealsService,
} from "@/services/mechanics";
import type {
  DelegateNoteCreate,
  DelegateNoteFilters,
  NetWorthTransactionCreate,
  NetWorthTransactionFilters,
  SealIssue,
  SealRevoke,
  SealSpend,
  SealTransfer,
} from "@/types/api";

// The frontroom is left open on a projector, so its queries poll to pick up
// backroom edits without anyone touching it.
const FRONTROOM_POLL_MS = 5000;

// ── Net worth ────────────────────────────────────────────────────────────────

export function useNetWorths(opts: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: ["net-worth"],
    queryFn: () => netWorthService.list(),
    refetchInterval: opts.poll ? FRONTROOM_POLL_MS : false,
  });
}

export function useNetWorthTransactions(filters: NetWorthTransactionFilters = {}) {
  return useQuery({
    queryKey: ["net-worth", "transactions", filters],
    queryFn: () => netWorthService.transactions(filters),
  });
}

export function useNetWorthHistory(characterId: number | null, opts: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: ["net-worth", "history", characterId],
    queryFn: () => netWorthService.history(characterId!),
    enabled: characterId !== null,
    refetchInterval: opts.poll ? FRONTROOM_POLL_MS : false,
  });
}

export function useCreateNetWorthTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NetWorthTransactionCreate) => netWorthService.createTransaction(body),
    onSuccess: (txn) => {
      qc.invalidateQueries({ queryKey: ["net-worth"] });
      // A new crisis note may have been filed alongside the change.
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      toast.success(txn.kind === "TRANSFER" ? "Transfer recorded." : "Net worth updated.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update net worth."),
  });
}

// ── Wax seals ────────────────────────────────────────────────────────────────

export function useSealHoldings() {
  return useQuery({ queryKey: ["seals", "holdings"], queryFn: () => sealsService.holdings() });
}

/** Seal ledger; ``character_id`` = movements into or out of that delegate. */
export function useSealMovements(filters: { character_id?: number } = {}) {
  return useQuery({
    queryKey: ["seals", "movements", filters],
    queryFn: () => sealsService.movements(filters),
  });
}

function useSealMutation<TArgs>(
  fn: (args: TArgs) => Promise<unknown>,
  success: string,
  failure: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seals"] });
      // Spends change the seal totals shown on directives.
      qc.invalidateQueries({ queryKey: ["delegate-notes"] });
      toast.success(success);
    },
    onError: (err: Error) => toast.error(err.message || failure),
  });
}

export function useIssueSeals() {
  return useSealMutation((b: SealIssue) => sealsService.issue(b), "Seals issued.", "Failed to issue seals.");
}

export function useTransferSeals() {
  return useSealMutation(
    (b: SealTransfer) => sealsService.transfer(b),
    "Seals transferred.",
    "Failed to transfer seals."
  );
}

export function useSpendSeals() {
  return useSealMutation((b: SealSpend) => sealsService.spend(b), "Seals spent.", "Failed to spend seals.");
}

export function useRevokeSeals() {
  return useSealMutation(
    (b: SealRevoke) => sealsService.revoke(b),
    "Seals revoked.",
    "Failed to revoke seals."
  );
}

// ── Delegate notes ───────────────────────────────────────────────────────────

export function useDelegateNotes(filters: DelegateNoteFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ["delegate-notes", filters],
    queryFn: () => delegateNotesService.list(filters),
    enabled,
  });
}

export function useDeleteDelegateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => delegateNotesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delegate-notes"] });
      qc.invalidateQueries({ queryKey: ["seals"] });
      toast.success("Directive deleted.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete directive."),
  });
}

export function useCreateDelegateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DelegateNoteCreate) => delegateNotesService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delegate-notes"] });
      // Seals attached to the directive were spent.
      qc.invalidateQueries({ queryKey: ["seals"] });
      toast.success("Directive added.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add directive."),
  });
}
