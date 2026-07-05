// Server-only: assembles a per-tenant `LedgerDashboardData` so the real
// `DashboardGrid` (built for the single-tenant SQLite dashboard) can render
// on the self-service `/workspace` route.
//
// PHASE 1+2+3+4 of the DashboardGrid port. Populated: totals P&L
// (income/expenses/ebitda/margin/average-income/overhead/runway), liquidity
// (cash/credit limit/credit headroom/available liquidity), creditFacilities,
// balances[].liquidityTier (Phase 1), plus pnl monthly series, income/expense
// breakdowns, net-worth trend, recent transactions, recurring payments, and
// category/daily spend (Phase 2+3). Phase 4 (added here): suspense queue,
// pipeline health, routing/classification confidence, and knownAccounts (the
// classify-as picker's options) — see workspaceSuspenseMath.ts /
// workspacePipeline.ts. Still left as a safe empty array: source accounts,
// sync state — no per-tenant equivalent yet. The workspace widget allowlist
// (`components/workspace/workspaceWidgetIds.ts`) only exposes widgets that
// read fields this module actually populates.
//
// Every read here goes through the caller's RLS-scoped Supabase client
// (never service_role) via getWorkspaceLedger / workspacePnl /
// workspaceLiquidity / workspaceBreakdowns / workspaceJournal /
// workspacePipeline.
import { getWorkspaceLedger } from "./workspaceLedger";
import { getWorkspacePnl } from "./workspacePnl";
import { getWorkspaceLiquidity } from "./workspaceLiquidity";
import { getWorkspaceAccountBreakdowns } from "./workspaceBreakdowns";
import { fetchTenantJournalEntries } from "./workspaceJournal";
import { getWorkspacePipelineHealth } from "./workspacePipeline";
import { computeWorkspaceNetWorthTrend } from "./workspaceTrends";
import { computeWorkspaceRecentTransactions } from "./workspaceTransactions";
import { computeWorkspaceRecurringPayments } from "./workspaceRecurring";
import {
  computeWorkspaceCategoryMonthly,
  computeWorkspaceDailySpend,
} from "./workspaceSpending";
import {
  computeRoutingHealth,
  computeSuspenseQueue,
  isSuspenseAccount,
} from "./workspaceSuspenseMath";
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";

/** The caller's tenant, reshaped into a Phase-1+2+3+4 `LedgerDashboardData`. */
export async function getWorkspaceDashboard(): Promise<LedgerDashboardData> {
  const ledger = await getWorkspaceLedger();

  const [pnl, liquidity, breakdowns, journalEntries, pipeline] = await Promise.all([
    getWorkspacePnl(ledger.tenantId, ledger.totals.assetsCents),
    getWorkspaceLiquidity(ledger.tenantId, ledger.balances, ledger.currency),
    getWorkspaceAccountBreakdowns(ledger.tenantId),
    fetchTenantJournalEntries(ledger.tenantId),
    getWorkspacePipelineHealth(ledger.tenantId),
  ]);

  const netWorthTrend = computeWorkspaceNetWorthTrend(journalEntries);
  const recentTransactions = computeWorkspaceRecentTransactions(journalEntries);
  const recurringPayments = computeWorkspaceRecurringPayments(journalEntries);
  const categoryMonthly = computeWorkspaceCategoryMonthly(journalEntries);
  const dailySpend = computeWorkspaceDailySpend(journalEntries);
  const suspenseQueue = computeSuspenseQueue(journalEntries, ledger.suspenseAccount);
  const routing = computeRoutingHealth(journalEntries, ledger.suspenseAccount);
  const knownAccounts = [
    ...new Set(
      journalEntries
        .map((entry) => entry.account)
        .filter((account) => !isSuspenseAccount(account, ledger.suspenseAccount)),
    ),
  ].sort();

  return {
    databasePath: `postgres:tenant:${ledger.tenantId}`,
    databaseExists: true,
    generatedAt: new Date().toISOString(),
    manualBalances: ledger.manualBalances.map((balance) => ({
      account: balance.account,
      balanceCents: balance.balanceCents,
      asOfDate: balance.asOfDate,
      updatedAt: balance.updatedAt,
    })),
    totals: {
      netWorthCents: ledger.totals.netWorthCents,
      assetsCents: ledger.totals.assetsCents,
      liabilitiesCents: ledger.totals.liabilitiesCents,
      assetLiabilityRatio: ledger.totals.assetLiabilityRatio,
      incomeCents: pnl.incomeCents,
      expensesCents: pnl.expensesCents,
      ebitdaCents: pnl.ebitdaCents,
      ebitdaMargin: pnl.ebitdaMargin,
      averageMonthlyIncomeCents: pnl.averageMonthlyIncomeCents,
      monthlyOverheadCents: pnl.monthlyOverheadCents,
      runwayMonths: pnl.runwayMonths,
      transactionCount: routing.journalCount,
      rawTransactionCount: pipeline.rawCached,
      cashCents: liquidity.cashCents,
      creditHeadroomCents: liquidity.creditHeadroomCents,
      creditLimitCents: liquidity.creditLimitCents,
      availableLiquidityCents: liquidity.availableLiquidityCents,
    },
    balances: liquidity.balances,
    creditFacilities: liquidity.creditFacilities,
    pnl: pnl.pnl,
    incomeBreakdown: breakdowns.incomeBreakdown,
    expenseBreakdown: breakdowns.expenseBreakdown,
    suspenseQueue,
    netWorthTrend,
    recentTransactions,
    recurringPayments,
    categoryMonthly,
    dailySpend,
    pipeline,
    sourceAccounts: [],
    knownAccounts,
    routing,
    syncState: [],
    error: null,
  };
}
