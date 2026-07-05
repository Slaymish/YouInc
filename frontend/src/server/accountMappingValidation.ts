// Pure validation/normalization for account-mapping edits, kept
// dependency-free (no Supabase, no `~/` aliases) so it can be unit-tested under
// the plugin-free vitest config. accountMappings.ts composes these.
//
// An account mapping is the DB form of rules.yaml's `account_mappings`: it
// tells the ingestion pipeline which ledger account a synced Akahu account
// should post to, and (for liabilities only) what its credit limit is.

export type AccountMappingType = "asset" | "liability";

export interface AccountMappingInput {
  akahuAccountId: string;
  ledgerAccount: string;
  accountType: AccountMappingType;
  creditLimitCents: number | null;
}

/** Raised on invalid input; accountMappings.ts maps this to a 400 Response. */
export class AccountMappingValidationError extends Error {}

/** Convert a decimal-dollars amount to integer cents (rounds to nearest cent). */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Format integer cents back to a dollars string for an editable input. */
export function centsToDollarsInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Normalize + validate an account-mapping input. Throws
 * AccountMappingValidationError with a user-facing message on any problem.
 * Returns the input with trimmed fields; a credit limit is only kept for
 * liability accounts (asset accounts never carry one).
 */
export function normalizeAccountMappingInput(
  input: AccountMappingInput,
): AccountMappingInput {
  const akahuAccountId = input.akahuAccountId.trim();
  const ledgerAccount = input.ledgerAccount.trim();

  if (akahuAccountId.length === 0) {
    throw new AccountMappingValidationError(
      "Choose or enter an Akahu account id.",
    );
  }
  if (!ledgerAccount.includes(":")) {
    throw new AccountMappingValidationError(
      "Ledger account must be namespaced, e.g. Assets:Checking.",
    );
  }
  if (input.accountType !== "asset" && input.accountType !== "liability") {
    throw new AccountMappingValidationError(
      "Account type must be asset or liability.",
    );
  }

  const creditLimitCents =
    input.accountType === "liability" ? input.creditLimitCents : null;
  if (creditLimitCents != null) {
    if (!Number.isFinite(creditLimitCents) || creditLimitCents < 0) {
      throw new AccountMappingValidationError(
        "Credit limit must be a positive amount.",
      );
    }
  }

  return { akahuAccountId, ledgerAccount, accountType: input.accountType, creditLimitCents };
}
