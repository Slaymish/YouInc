// Pure suspense-queue + routing-health math for the /workspace dashboard —
// dependency-free (no Supabase, no `~/` aliases) so it can be unit-tested
// under the plugin-free vitest config, mirroring workspaceSummary.ts. The
// Postgres fetch/mutation lives in workspaceDashboard.ts (read) and
// tenantReclassify.ts (write); both call into this module.
//
// Ported from the retired single-tenant SQLite `suspenseRow` / `routingRow` /
// `suspenseQueueRows` queries in server/ledger.ts (see git history at
// 6065eee~1). One important divergence from that SQLite version: this engine
// now supports *reclassifying* a suspense item (tenantReclassify.ts), which
// works by inserting a NEW correcting journal_transaction rather than
// mutating the original row (immutability + audit trail). That correction:
//   - reverses the original suspense-account posting (opposite side, same
//     amount), and
//   - posts the same amount, same side the suspense leg originally had, to
//     the new target account.
// So "is this transaction still in suspense" can no longer be answered by
// looking at a single row — it's the NET of every suspense-account posting
// tied to the same original transaction (original leg + any correction)."net
// zero" means resolved; nonzero means still open. Corrections are linked to
// their original transaction via the external_id convention below (see
// `reclassifyExternalId` / `rootExternalId`) rather than a schema change.
export interface SuspenseSourceEntry {
  /** Groups postings into one transaction; stable per-transaction key. */
  transactionId: string;
  externalId: string;
  transactionDate: string;
  description: string;
  ruleId: string | null;
  sourceAccountId: string;
  account: string;
  side: "debit" | "credit";
  amountCents: number;
}

export interface RoutingHealth {
  journalCount: number;
  customRuleCount: number;
  nzfccFallbackCount: number;
  suspenseCount: number;
  suspenseCents: number;
  classificationRate: number | null;
}

export interface SuspenseItem {
  externalId: string;
  transactionDate: string;
  description: string;
  /** Signed cents: negative when money left the account, positive when it arrived. */
  amountCents: number;
  /** "out" = money left the account, "in" = money arrived. */
  direction: "in" | "out";
  /** The real (non-suspense) account the money moved through. */
  counterAccount: string;
}

/** rule_id marker for a reclassify correction transaction (see tenantReclassify.ts). */
export const RECLASSIFY_RULE_ID = "manual:reclass";
/** rule_id marker the retired SQLite engine used for the opening-balance seed. */
const OPENING_BALANCE_RULE_ID = "manual:opening_balance";
/** Synthetic journal_transactions.source_account_id for non-Akahu-sourced rows. */
const MANUAL_SOURCE_ACCOUNT_ID = "manual";

const RECLASSIFY_MARKER = "::reclass::";

/** Build a correction transaction's external_id from the original's. */
export function reclassifyExternalId(originalExternalId: string, correctionId: string): string {
  return `${originalExternalId}${RECLASSIFY_MARKER}${correctionId}`;
}

/** The original transaction's external_id a correction's external_id was derived from (identity if not a correction). */
export function rootExternalId(externalId: string): string {
  const markerIndex = externalId.indexOf(RECLASSIFY_MARKER);
  return markerIndex === -1 ? externalId : externalId.slice(0, markerIndex);
}

/** True when `account` is the tenant's suspense account or a sub-account of it. */
export function isSuspenseAccount(account: string, suspenseAccount: string): boolean {
  return account === suspenseAccount || account.startsWith(`${suspenseAccount}:`);
}

function isNzfccRule(ruleId: string | null): boolean {
  return ruleId !== null && ruleId.startsWith("nzfcc:");
}

function isCustomRule(ruleId: string | null): boolean {
  return (
    ruleId !== null &&
    !isNzfccRule(ruleId) &&
    ruleId !== OPENING_BALANCE_RULE_ID &&
    ruleId !== RECLASSIFY_RULE_ID
  );
}

interface TransactionHeader {
  transactionId: string;
  ruleId: string | null;
  sourceAccountId: string;
}

/** Collapse posting-level rows into one row per transaction (dedupe by transactionId). */
function dedupeTransactions(entries: readonly SuspenseSourceEntry[]): TransactionHeader[] {
  const seen = new Map<string, TransactionHeader>();
  for (const entry of entries) {
    if (!seen.has(entry.transactionId)) {
      seen.set(entry.transactionId, {
        transactionId: entry.transactionId,
        ruleId: entry.ruleId,
        sourceAccountId: entry.sourceAccountId,
      });
    }
  }
  return [...seen.values()];
}

interface SuspenseGroup {
  /** Net signed cents across every suspense-account posting for this root id: debit +, credit -. */
  netDebitCents: number;
  /** The original (non-correction) suspense-account posting, if seen. */
  original: SuspenseSourceEntry | null;
}

/**
 * Open suspense items: every original transaction whose suspense-account
 * postings (original leg + any reclassify correction) don't net to zero.
 * Once a reclassify correction lands, the group nets to zero and the item
 * silently drops out of the queue — no row is ever mutated to make that
 * happen.
 */
export function computeSuspenseQueue(
  entries: readonly SuspenseSourceEntry[],
  suspenseAccount: string,
): SuspenseItem[] {
  const groups = new Map<string, SuspenseGroup>();

  for (const entry of entries) {
    if (!isSuspenseAccount(entry.account, suspenseAccount)) continue;
    const root = rootExternalId(entry.externalId);
    const group = groups.get(root) ?? { netDebitCents: 0, original: null };
    const signed = entry.side === "debit" ? entry.amountCents : -entry.amountCents;
    const isOriginal = entry.externalId === root;
    groups.set(root, {
      netDebitCents: group.netDebitCents + signed,
      original: isOriginal ? entry : group.original,
    });
  }

  const items: SuspenseItem[] = [];
  for (const [root, group] of groups) {
    if (group.netDebitCents === 0 || group.original === null) continue;
    const original = group.original;
    const counterAccount =
      entries.find(
        (e) => e.transactionId === original.transactionId && !isSuspenseAccount(e.account, suspenseAccount),
      )?.account ?? "";
    const direction: SuspenseItem["direction"] = group.netDebitCents > 0 ? "out" : "in";
    items.push({
      externalId: root,
      transactionDate: original.transactionDate,
      description: original.description,
      amountCents: -group.netDebitCents,
      direction,
      counterAccount,
    });
  }

  return items.sort((a, b) => {
    if (a.transactionDate !== b.transactionDate) {
      return a.transactionDate < b.transactionDate ? 1 : -1;
    }
    return a.externalId < b.externalId ? 1 : a.externalId > b.externalId ? -1 : 0;
  });
}

/**
 * Routing/classification health across the tenant's journal. Reclassify
 * correction transactions (rule_id === RECLASSIFY_RULE_ID) are bookkeeping
 * plumbing, not user-facing transactions, so — like the retired SQLite
 * query's `source_account_id != 'manual'` filter — they're excluded from
 * every count here.
 */
export function computeRoutingHealth(
  entries: readonly SuspenseSourceEntry[],
  suspenseAccount: string,
): RoutingHealth {
  const transactions = dedupeTransactions(entries).filter(
    (t) => t.sourceAccountId !== MANUAL_SOURCE_ACCOUNT_ID && t.ruleId !== RECLASSIFY_RULE_ID,
  );

  const journalCount = transactions.length;
  const customRuleCount = transactions.filter((t) => isCustomRule(t.ruleId)).length;
  const nzfccFallbackCount = transactions.filter((t) => isNzfccRule(t.ruleId)).length;

  const queue = computeSuspenseQueue(entries, suspenseAccount);
  const suspenseCount = queue.length;
  const suspenseCents = queue.reduce((total, item) => total + Math.abs(item.amountCents), 0);

  return {
    journalCount,
    customRuleCount,
    nzfccFallbackCount,
    suspenseCount,
    suspenseCents,
    classificationRate: journalCount > 0 ? (journalCount - suspenseCount) / journalCount : null,
  };
}
