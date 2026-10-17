import type { JournalTransaction, Posting, Side } from './journal.ts';
import { posting, validateBalanced } from './journal.ts';
import type { RawTransaction as Raw } from './rawTransaction.ts';

/**
 * Transaction → balanced journal, ported from
 * frontend/src/server/ledger-engine/pipeline.ts and rulesRouter.ts.
 *
 * The original routes each transaction independently to one target account.
 * That is kept as the fallback, but it is wrong for money moving between his
 * own accounts: with two feeds synced, one transfer shows up twice and both
 * independent routings distort the books. So transfers are detected first and
 * post once (see transfers.ts); everything else routes through the engine.
 */

type RawTransactionShape = {
  idempotencyHash: string;
  akahuTransactionId: string | null;
  accountId: string;
  status: string;
  amountCents: number;
  currency: string;
  transactionDate: string;
  settlementDate: string | null;
  description: string;
  merchantName: string | null;
  nzfcc: string | null;
  isPending: boolean;
  rawJson: string;
};

export type RawTransaction = Raw;

export interface Rule {
  id: string;
  priority: number;
  match: {
    description_regex?: string;
    merchant_regex?: string;
    amount_greater_than?: number;
    amount_abs_greater_than?: number;
  };
  route: { target_account: string; memo?: string };
}

export type MatchedBy = 'rule' | 'nzfcc' | 'suspense' | 'manual' | 'transfer';

export interface RouteDecision {
  targetAccount: string;
  ruleId: string | null;
  memo: string | null;
  matchedBy: MatchedBy;
}

export interface AccountMapping {
  ledgerAccount: string;
  accountType: 'asset' | 'liability';
}

export interface RoutingConfig {
  suspenseAccount: string;
  rules: Rule[];
  nzfccMappings: Record<string, string>;
  accountMappings: Record<string, AccountMapping>;
}

export const DEFAULT_SUSPENSE = 'Expenses:Uncategorized:Suspense';

/** Python `re.search` accepts a leading inline flag group; V8 does not. */
function translatePythonRegex(pattern: string): RegExp {
  let body = pattern;
  let flags = '';
  const leading = /^\(\?([a-zA-Z]+)\)/.exec(body);
  if (leading) {
    body = body.slice(leading[0].length);
    for (const flag of leading[1]) {
      if (flag === 'i' || flag === 'm' || flag === 's') {
        if (!flags.includes(flag)) flags += flag;
      } else {
        throw new Error(`Unsupported inline regex flag '(?${leading[1]})' in pattern: ${pattern}`);
      }
    }
  }
  return new RegExp(body, flags);
}

const UNMAPPED_SANITIZE = /[^A-Za-z0-9_:-]/g;

export function accountMappingFor(config: RoutingConfig, accountId: string): AccountMapping {
  const mapped = config.accountMappings[accountId];
  if (mapped) return mapped;
  return { ledgerAccount: `Assets:Unmapped:${accountId.replace(UNMAPPED_SANITIZE, '_')}`, accountType: 'asset' };
}

export function route(config: RoutingConfig, transaction: RawTransaction): RouteDecision {
  const rules = config.rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => (a.rule.priority !== b.rule.priority ? a.rule.priority - b.rule.priority : a.index - b.index));

  for (const { rule } of rules) {
    const { match } = rule;
    if (match.description_regex) {
      if (!translatePythonRegex(match.description_regex).test(transaction.description)) continue;
    }
    if (match.merchant_regex) {
      const merchant = transaction.merchantName ?? '';
      if (!translatePythonRegex(match.merchant_regex).test(merchant)) continue;
    }
    if (match.amount_greater_than !== undefined && !(transaction.amountCents > Math.round(match.amount_greater_than * 100))) continue;
    if (match.amount_abs_greater_than !== undefined && !(Math.abs(transaction.amountCents) > Math.round(match.amount_abs_greater_than * 100))) continue;
    return { targetAccount: rule.route.target_account, ruleId: rule.id, memo: rule.route.memo ?? null, matchedBy: 'rule' };
  }

  if (transaction.nzfcc && config.nzfccMappings[transaction.nzfcc]) {
    return { targetAccount: config.nzfccMappings[transaction.nzfcc], ruleId: `nzfcc:${transaction.nzfcc}`, memo: null, matchedBy: 'nzfcc' };
  }

  return { targetAccount: config.suspenseAccount, ruleId: null, memo: null, matchedBy: 'suspense' };
}

/**
 * Build the journal for a single transaction.
 *
 * Positive amount (money in): the source account is DEBITed, the target
 * CREDITed. Negative (money out): target DEBITed, source CREDITed.
 */
export function buildJournal(
  config: RoutingConfig,
  transaction: RawTransaction,
  override?: { targetAccount: string; memo?: string | null } | null,
): JournalTransaction {
  const mapping = accountMappingFor(config, transaction.accountId);
  const decision: RouteDecision = override
    ? { targetAccount: override.targetAccount, ruleId: 'manual:override', memo: override.memo ?? null, matchedBy: 'manual' }
    : route(config, transaction);
  return journalForLeg(transaction, mapping, decision, transaction.idempotencyHash);
}

export function journalForLeg(
  transaction: RawTransaction,
  mapping: AccountMapping,
  decision: RouteDecision,
  externalId: string,
): JournalTransaction {
  const amountCents = Math.abs(transaction.amountCents);
  const postings: [Posting, Posting] =
    transaction.amountCents > 0
      ? [posting(mapping.ledgerAccount, 'debit', amountCents), posting(decision.targetAccount, 'credit', amountCents)]
      : [posting(decision.targetAccount, 'debit', amountCents), posting(mapping.ledgerAccount, 'credit', amountCents)];
  const journal: JournalTransaction = {
    externalId,
    transactionDate: transaction.settlementDate ? transaction.settlementDate.slice(0, 10) : transaction.transactionDate,
    description: transaction.description,
    sourceAccountId: transaction.accountId,
    status: transaction.status,
    ruleId: decision.ruleId,
    postings,
  };
  validateBalanced(journal);
  return journal;
}

export type { Side, Posting, JournalTransaction };
