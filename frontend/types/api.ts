export interface HealthResponse {
  status: string;
}

export type Priority = "HIGH" | "MEDIUM" | "LOW";
export type NoteType = "PRIVATE_DIRECTIVE" | "PUBLIC_DIRECTIVE";

// ── Characters ───────────────────────────────────────────────────────────────

export interface CharacterResponse {
  id: number;
  name: string;
  created_at: string;
}

export interface CharacterCreate {
  name: string;
}

export interface BulkUploadResult {
  created: number;
  skipped: number;
}

// ── Crisis Periods ────────────────────────────────────────────────────────────

export interface CrisisPeriodResponse {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  archived_at: string | null;
}

export interface CrisisPeriodCreate {
  name: string;
}

// ── Crisis Notes ──────────────────────────────────────────────────────────────

export interface CrisisNoteResponse {
  id: number;
  period_id: number;
  character: CharacterResponse;
  title: string;
  description: string;
  crisis_staff_notes: string | null;
  priority: Priority;
  note_type: NoteType;
  created_at: string;
}

export interface CrisisNoteCreate {
  character_id: number;
  // The period the client expects the note to land in. The backend rejects
  // the submission (409) if the active period has changed since, instead of
  // silently filing it under a different period than the user saw.
  period_id?: number;
  title: string;
  description: string;
  crisis_staff_notes?: string;
  priority: Priority;
  note_type: NoteType;
}

export interface CrisisNoteUpdate {
  character_id?: number;
  title?: string;
  description?: string;
  crisis_staff_notes?: string | null;
  priority?: Priority;
  note_type?: NoteType;
}

export interface NoteFilters {
  period_id?: number;
  archived_only?: boolean;
  character_id?: number;
  priority?: Priority;
  note_type?: NoteType;
  q?: string;
}

// ── Staff Notes ───────────────────────────────────────────────────────────────

export interface StaffNoteResponse {
  id: number;
  period_id: number;
  title: string;
  content: string;
  created_at: string;
}

export interface StaffNoteCreate {
  title: string;
  content: string;
}

export interface StaffNoteUpdate {
  title?: string;
  content?: string;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface NotesByCharacter {
  character_name: string;
  count: number;
}

export interface PriorityCount {
  priority: Priority;
  count: number;
}

export interface AnalyticsSummary {
  total_notes: number;
  notes_by_character: NotesByCharacter[];
  priority_distribution: PriorityCount[];
  private_directive_count: number;
  public_directive_count: number;
}

// ── Net Worth ─────────────────────────────────────────────────────────────────

export type TransactionKind = "ADJUSTMENT" | "TRANSFER" | "FLUCTUATION";

export interface DelegateNetWorth {
  id: number;
  name: string;
  net_worth: number;
  baseline_net_worth: number;
  skip_fluctuation: boolean;
}

export interface NetWorthChange {
  character_id: number;
  delta: number;
}

// Every manual change needs a crisis note: link an existing one by id, or
// send a new one to be created alongside the change.
export type NetWorthTransactionCreate = {
  kind: Exclude<TransactionKind, "FLUCTUATION">;
  description?: string;
  changes: NetWorthChange[];
} & ({ crisis_note_id: number } | { crisis_note: CrisisNoteCreate });

export interface LinkedCrisisNote {
  id: number;
  title: string;
  note_type: NoteType;
}

export interface NetWorthEntry {
  character_id: number;
  character_name: string;
  delta: number;
  balance_after: number;
}

export interface NetWorthTransaction {
  id: number;
  kind: TransactionKind;
  description: string;
  created_at: string;
  /** The crisis update (period) this change was filed in. */
  period_id: number | null;
  crisis_note: LinkedCrisisNote | null;
  entries: NetWorthEntry[];
}

export interface NetWorthTransactionFilters {
  character_id?: number;
  period_id?: number;
  archived_only?: boolean;
}

export interface NetWorthHistoryPoint {
  at: string;
  net_worth: number;
  kind: TransactionKind | null;
}

// ── Wax Seals ─────────────────────────────────────────────────────────────────

export interface DelegateSeals {
  id: number;
  name: string;
  seal_count: number;
}

export interface SealGrant {
  character_id: number;
  quantity: number;
}

export type SealAction = "ISSUED" | "TRANSFERRED" | "SPENT" | "REVOKED";

export interface LinkedDirective {
  id: number;
  title: string;
  note_type: DelegateNoteType;
}

/** One line of the wax seal ledger. Null from = issued by staff; null to = spent/revoked. */
export interface SealMovement {
  id: number;
  action: SealAction;
  quantity: number;
  from_character: CharacterResponse | null;
  to_character: CharacterResponse | null;
  crisis_note: LinkedCrisisNote | null;
  directive: LinkedDirective | null;
  reason: string | null;
  created_at: string;
}

export interface SealIssue {
  grants: SealGrant[];
  reason?: string;
}

export interface SealTransfer {
  from_character_id: number;
  to_character_id: number;
  quantity: number;
  reason?: string;
}

/** Attach seals to exactly one crisis note or directive. */
export type SealSpend = {
  character_id: number;
  quantity: number;
  reason?: string;
} & ({ crisis_note_id: number } | { directive_id: number });

export interface SealRevoke {
  character_id: number;
  quantity: number;
  reason: string;
}

// ── Delegate Notes ────────────────────────────────────────────────────────────

export type DelegateNoteType = "PRIVATE_DIRECTIVE" | "PUBLIC_DIRECTIVE";

export interface DelegateNoteResponse {
  id: number;
  title: string;
  note_type: DelegateNoteType;
  contents: string;
  characters: CharacterResponse[];
  /** The crisis update (period) this directive was filed in. */
  period_id: number | null;
  /** Wax seals attached to (spent on) this directive. */
  seals: number;
  created_at: string;
}

export interface DelegateNoteFilters {
  period_id?: number;
  archived_only?: boolean;
  character_id?: number;
  note_type?: DelegateNoteType;
  q?: string;
}

export interface DelegateNoteCreate {
  title: string;
  note_type: DelegateNoteType;
  character_ids: number[];
  contents: string;
  /** Wax seals to attach; spent together with creating the directive. */
  seals?: SealGrant[];
}
