// Server-only, tenant-scoped Postgres liquidity read for the self-service
// /workspace dashboard (Phase 1 of the DashboardGrid port — see
// workspaceDashboard.ts).
//
// The Phase-1 math (annotateLiquidityTier / computeWorkspaceLiquidity, which
// reuse computeCreditFacilities / computeCashCents / computeLiquidityTotals /
// liquidityTierForAccount from ledgerAggregates.ts VERBATIM) lives in the
// dependency-free workspaceLiquidityMath.ts so it can be unit-tested without
// the Supabase client. This module's only job is fetching the tenant's
// `account_mappings` (the Postgres form of rules.yaml's `account_mappings`,
// which is where SQLite reads its credit_limit_cents from too).
import { getSupabaseServerClient } from "./supabaseServer";
import { throwServerError } from "./serverError";
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

/** The tenant's liability account mappings that carry a configured credit limit. */
export async function fetchCreditFacilityMappings(
  tenantId: string,
): Promise<CreditFacilityMapping[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("account_mappings")
    .select("akahu_account_id, ledger_account, credit_limit_cents")
    .eq("tenant_id", tenantId)
    .eq("account_type", "liability")
    .not("credit_limit_cents", "is", null);
  if (error) {
    throwServerError(
      error.message || "Could not load your credit facilities.",
      400,
    );
  }
  return ((data ?? []) as AccountMappingCreditRow[]).map((row) => ({
    accountId: row.akahu_account_id,
    ledgerAccount: row.ledger_account,
    creditLimitCents:
      row.credit_limit_cents === null ? null : Number(row.credit_limit_cents),
  }));
}

/** The caller's tenant liquidity picture (Phase-1 fields only). */
export async function getWorkspaceLiquidity(
  tenantId: string,
  balances: readonly AccountBalance[],
  currency: string,
): Promise<WorkspaceLiquidity> {
  const mappings = await fetchCreditFacilityMappings(tenantId);
  const annotated = annotateLiquidityTier(balances, currency);
  return computeWorkspaceLiquidity(mappings, annotated);
}
