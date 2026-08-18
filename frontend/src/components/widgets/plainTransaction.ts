// Turns a ledger transaction into the four things a person actually reads:
// when, what, which category, and how much went in or out. Pure so it can be
// unit-tested without a database — the Activity page's whole job depends on
// this being right.
import { accountType } from "~/server/accountType";

export interface PlainPosting {
  account: string;
  side: "debit" | "credit";
  amountCents: number;
}

export interface PlainTransactionInput {
  externalId: string;
  transactionDate: string;
  description: string;
  postings: readonly PlainPosting[];
}

export interface PlainTransaction {
  externalId: string;
  date: string;
  description: string;
  /** Leaf of the category account ("Groceries"), or null when there isn't one. */
  category: string | null;
  /** Full account path, for the rare case someone wants to see it. */
  categoryAccount: string | null;
  amountCents: number;
  direction: "in" | "out";
  /** True when nothing has categorised it yet. */
  needsCategory: boolean;
}

/**
 * The last segment of an account path: "Expenses:Utilities:Power" -> "Power".
 * Deliberately not `leafAccount` from format.ts, which keeps two-segment paths
 * whole ("Expenses:Groceries") because the constrained widgets want that.
 */
function categoryLabel(account: string): string {
  const parts = account.split(":");
  return parts[parts.length - 1] || account;
}

/** Where money sits, as opposed to what it was for. */
const BALANCE_TYPES = new Set(["Assets", "Liabilities", "Equity"]);

function isSuspense(account: string): boolean {
  return /(^|:)suspense/i.test(account);
}

/**
 * The category leg is the posting that isn't an account balance — the expense
 * or income side. A transfer between two of your own accounts has no category
 * leg, which is why `category` is nullable rather than invented.
 */
export function toPlainTransaction(tx: PlainTransactionInput): PlainTransaction {
  const categoryLeg =
    tx.postings.find((p) => !BALANCE_TYPES.has(accountType(p.account))) ?? null;
  const amountLeg = categoryLeg ?? tx.postings[0] ?? null;
  const needsCategory = categoryLeg !== null && isSuspense(categoryLeg.account);

  return {
    externalId: tx.externalId,
    date: tx.transactionDate,
    description: tx.description,
    category: needsCategory || !categoryLeg ? null : categoryLabel(categoryLeg.account),
    categoryAccount: categoryLeg?.account ?? null,
    amountCents: Math.abs(amountLeg?.amountCents ?? 0),
    // A debit to an expense account is money leaving; a credit to income is
    // money arriving. Fall back to the first posting for a bare transfer.
    direction: amountLeg?.side === "debit" ? "out" : "in",
    needsCategory,
  };
}

/** Newest first, then by description so equal dates render deterministically. */
export function sortPlainTransactions(rows: readonly PlainTransaction[]): PlainTransaction[] {
  return [...rows].sort(
    (a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description),
  );
}
