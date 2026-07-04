// Pure liquidity math for the /workspace dashboard — dependency-free (no
// Supabase, no `~/` aliases) so it can be unit-tested under the plugin-free
// vitest config, mirroring workspaceSummary.ts. The Postgres fetch lives in
// workspaceLiquidity.ts and calls this.
import type { AccountBalance } from "./workspaceSummary";
import {
  computeCashCents,
  computeCreditFacilities,
  computeLiquidityTotals,
  liquidityTierForAccount,
  type CreditFacilityMapping,
  type CreditFacilityRow,
  type LiquidityBalance,
  type LiquidityTier,
} from "./ledgerAggregates";

/** Every combined balance (journal + manual), tagged with a liquidity tier. */
export interface WorkspaceBalanceRow extends AccountBalance {
  currency: string;
  liquidityTier: LiquidityTier;
}

/** Tags each combined balance with its liquidity tier (verbatim rule). */
export function annotateLiquidityTier(
  balances: readonly AccountBalance[],
  currency: string,
): WorkspaceBalanceRow[] {
  return balances.map((balance) => ({
    ...balance,
    currency,
    liquidityTier: liquidityTierForAccount(balance.account),
  }));
}

export interface WorkspaceLiquidity {
  balances: WorkspaceBalanceRow[];
  creditFacilities: CreditFacilityRow[];
  cashCents: number;
  creditLimitCents: number;
  creditHeadroomCents: number;
  availableLiquidityCents: number;
}

/** Combines already-fetched mappings + already-annotated balances into the
 * Phase-1 liquidity fields. */
export function computeWorkspaceLiquidity(
  mappings: readonly CreditFacilityMapping[],
  balances: readonly WorkspaceBalanceRow[],
): WorkspaceLiquidity {
  const creditFacilities = computeCreditFacilities(mappings, balances);
  const cashCents = computeCashCents(balances as readonly LiquidityBalance[]);
  const { creditLimitCents, creditHeadroomCents, availableLiquidityCents } =
    computeLiquidityTotals(cashCents, creditFacilities);
  return {
    balances: [...balances],
    creditFacilities,
    cashCents,
    creditLimitCents,
    creditHeadroomCents,
    availableLiquidityCents,
  };
}
