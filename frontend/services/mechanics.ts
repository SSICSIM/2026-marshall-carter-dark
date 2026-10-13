import { apiClient } from "@/lib/apiClient";
import type {
  DelegateNetWorth,
  DelegateNoteCreate,
  DelegateNoteFilters,
  DelegateNoteResponse,
  NetWorthHistoryPoint,
  NetWorthTransaction,
  NetWorthTransactionCreate,
  NetWorthTransactionFilters,
  DelegateSeals,
  SealIssue,
  SealMovement,
  SealRevoke,
  SealSpend,
  SealTransfer,
} from "@/types/api";

function query(params: Record<string, string | number | boolean | undefined>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const netWorthService = {
  list: () => apiClient.get<DelegateNetWorth[]>("/api/net-worth"),
  transactions: (filters: NetWorthTransactionFilters = {}) =>
    apiClient.get<NetWorthTransaction[]>(`/api/net-worth/transactions${query({ ...filters })}`),
  createTransaction: (body: NetWorthTransactionCreate) =>
    apiClient.post<NetWorthTransaction>("/api/net-worth/transactions", body),
  history: (characterId: number) =>
    apiClient.get<NetWorthHistoryPoint[]>(`/api/net-worth/${characterId}/history`),
};

export const sealsService = {
  holdings: () => apiClient.get<DelegateSeals[]>("/api/seals"),
  movements: (filters: { character_id?: number } = {}) =>
    apiClient.get<SealMovement[]>(`/api/seals/movements${query(filters)}`),
  issue: (body: SealIssue) => apiClient.post<void>("/api/seals/issue", body),
  transfer: (body: SealTransfer) => apiClient.post<void>("/api/seals/transfer", body),
  spend: (body: SealSpend) => apiClient.post<void>("/api/seals/spend", body),
  revoke: (body: SealRevoke) => apiClient.post<void>("/api/seals/revoke", body),
};

export const delegateNotesService = {
  list: (filters: DelegateNoteFilters = {}) =>
    apiClient.get<DelegateNoteResponse[]>(`/api/delegate-notes${query({ ...filters })}`),
  create: (body: DelegateNoteCreate) =>
    apiClient.post<DelegateNoteResponse>("/api/delegate-notes", body),
  delete: (id: number) => apiClient.delete<void>(`/api/delegate-notes/${id}`),
};
