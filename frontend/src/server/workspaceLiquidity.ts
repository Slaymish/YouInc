import { rows } from "./database";
import type { AccountBalance } from "./workspaceSummary";
import type { CreditFacilityMapping } from "./ledgerAggregates";
import {
  annotateLiquidityTier,
  computeWorkspaceLiquidity,
  type WorkspaceLiquidity,
} from "./workspaceLiquidityMath";

export type { WorkspaceBalanceRow, WorkspaceLiquidity } from "./workspaceLiquidityMath";

interface AccountMappingCreditRow {
  akahu_account_id: string;
  ledger_account: string;
  credit_limit_cents: number | string | null;
}

/** The workspace's liability account mappings that carry a configured credit limit. */
export async function fetchCreditFacilityMappings(
  workspaceId: string,
): Promise<CreditFacilityMapping[]> {
  return rows<CreditFacilityMapping>(`SELECT akahu_account_id AS accountId,
    ledger_account AS ledgerAccount, credit_limit_cents AS creditLimitCents
    FROM account_mappings WHERE account_type='liability' AND credit_limit_cents IS NOT NULL`);
}

/** The caller's workspace liquidity picture (Phase-1 fields only). */
export async function getWorkspaceLiquidity(
  workspaceId: string,
  balances: readonly AccountBalance[],
  currency: string,
): Promise<WorkspaceLiquidity> {
  const mappings = await fetchCreditFacilityMappings(workspaceId);
  const annotated = annotateLiquidityTier(balances, currency);
  return computeWorkspaceLiquidity(mappings, annotated);
}
