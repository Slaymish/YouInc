// frontend/src/server/workspaceStage.ts
//
// Pure derivation of a self-service workspace's lifecycle "stage" from data the
// /workspace loader already fetches. Used to drive progressive disclosure:
// first-run users get a guided path (connect / add / sample) instead of six
// empty editors; returning users go straight to their finances.
//
// Plugin-free (no Supabase import) so it can be unit-tested under vitest.

/** How far along a workspace is in going from empty → live ledger. */
export type WorkspaceStage =
  // No accounts and no posted transactions — brand new; show the guided path.
  | "empty"
  // Has manual account balances but no journal-derived (synced) balances yet.
  | "has-accounts"
  // Has posted transactions in the double-entry ledger (bank/sample synced).
  | "synced";

export interface WorkspaceStageInput {
  /** Number of accounts contributing to the summary (manual + journal). */
  accountCount: number;
  /** Whether any journal-derived balances exist (i.e. transactions posted). */
  hasJournalBalances: boolean;
}

/**
 * Derive the workspace stage. `synced` takes precedence over `has-accounts`
 * because a posted ledger is the strongest signal of an active workspace.
 */
export function workspaceStage(input: WorkspaceStageInput): WorkspaceStage {
  if (input.hasJournalBalances) return "synced";
  if (input.accountCount > 0) return "has-accounts";
  return "empty";
}

/** True for a brand-new workspace that should see the guided first-run UI. */
export function isFirstRun(input: WorkspaceStageInput): boolean {
  return workspaceStage(input) === "empty";
}
