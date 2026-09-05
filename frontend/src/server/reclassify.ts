import crypto from "node:crypto";
import { validateBalanced, type JournalTransaction, type Posting } from "./ledger-engine/journal";
import { atomic, insertJournal, setting } from "./database";
import { readJournalEntries, type JournalEntryRow } from "./workspaceJournal";
import {
  RECLASSIFY_RULE_ID,
  computeSuspenseQueue,
  isSuspenseAccount,
  reclassifyExternalId,
  type SuspenseItem,
} from "./workspaceSuspenseMath";
import { throwServerError } from "./serverError";

interface WorkspaceContext {
  workspaceId: string;
  suspenseAccount: string;
}

export interface ReclassifySuspenseItemInput {
  /** The queued item's externalId (see SuspenseItem.externalId). */
  externalId: string;
  /** The real account to route this transaction to instead of suspense. */
  targetAccount: string;
}

function findOriginalSuspenseEntry(
  entries: readonly JournalEntryRow[],
  externalId: string,
  suspenseAccount: string,
): JournalEntryRow | undefined {
  return entries.find(
    (e) => e.externalId === externalId && isSuspenseAccount(e.account, suspenseAccount),
  );
}

/**
 * Reclassify one queued suspense transaction to a real target account by
 * posting a balanced correction transaction (see module docs). Returns the
 * caller's refreshed suspense queue so the widget can drop the resolved item
 * without a full page reload.
 */
export async function reclassifySuspenseItem(
  input: ReclassifySuspenseItemInput,
): Promise<SuspenseItem[]> {
  return atomic(() => {
  const workspace = { workspaceId: "local", suspenseAccount: setting("suspense") };
  const targetAccount = input.targetAccount.trim();

  if (!targetAccount.includes(":")) {
    throwServerError("Use a namespaced account, e.g. Expenses:Groceries.", 400);
  }
  if (isSuspenseAccount(targetAccount, workspace.suspenseAccount)) {
    throwServerError("Choose an account other than the suspense account.", 400);
  }

  const entries = readJournalEntries();

  const stillOpen = computeSuspenseQueue(entries, workspace.suspenseAccount).some(
    (item) => item.externalId === input.externalId,
  );
  if (!stillOpen) {
    throwServerError("That suspense item was not found (it may already be resolved).", 404);
  }

  const originalEntry = findOriginalSuspenseEntry(entries, input.externalId, workspace.suspenseAccount);
  if (!originalEntry) {
    throwServerError("That suspense item was not found (it may already be resolved).", 404);
  }

  const reversedSide: "debit" | "credit" = originalEntry.side === "debit" ? "credit" : "debit";
  const correctionExternalId = reclassifyExternalId(input.externalId, crypto.randomUUID());

  const postings: [Posting, Posting] = [
    { account: workspace.suspenseAccount, side: reversedSide, amountCents: originalEntry.amountCents, currency: originalEntry.currency },
    { account: targetAccount, side: originalEntry.side, amountCents: originalEntry.amountCents, currency: originalEntry.currency },
  ];
  const correction: JournalTransaction = {
    externalId: correctionExternalId,
    transactionDate: new Date().toISOString().slice(0, 10),
    description: `Reclassified: ${originalEntry.description}`,
    sourceAccountId: originalEntry.sourceAccountId,
    status: "posted",
    ruleId: RECLASSIFY_RULE_ID,
    postings,
  };
  validateBalanced(correction);

  insertJournal(correction);

  const refreshedEntries = readJournalEntries();
  return computeSuspenseQueue(refreshedEntries, workspace.suspenseAccount);
  });
}
