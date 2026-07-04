// Server-only: assembles a per-tenant `LedgerDashboardData` so the real
// `DashboardGrid` (built for the single-tenant SQLite dashboard) can render
// on the self-service `/workspace` route.
//
// PHASE 1+2+3 of the DashboardGrid port. Populated: totals P&L
// (income/expenses/ebitda/margin/average-income/overhead/runway), liquidity
// (cash/credit limit/credit headroom/available liquidity), creditFacilities,
// balances[].liquidityTier (Phase 1), plus pnl monthly series, income/expense
// breakdowns, net-worth trend, recent transactions, recurring payments, and
// category/daily spend (Phase 2+3). Still left as a safe empty array/zeroed
// struct: suspense queue, pipeline health, source accounts, known accounts,
// routing, sync state — Phase-4 ops/health fields with no per-tenant
// equivalent yet. The workspace widget allowlist
// (`components/workspace/workspaceWidgetIds.ts`) only exposes widgets that
// read fields this module actually populates.
//
// Every read here goes through the caller's RLS-scoped Supabase client
// (never service_role) via getWorkspaceLedger / workspacePnl /
// workspaceLiquidity / workspaceBreakdowns / workspaceJournal.
import { getWorkspaceLedger } from "./workspaceLedger";
import { getWorkspacePnl } from "./workspacePnl";
import { getWorkspaceLiquidity } from "./workspaceLiquidity";
import { getWorkspaceAccountBreakdowns } from "./workspaceBreakdowns";
import { fetchTenantJournalEntries } from "./workspaceJournal";
import { computeWorkspaceNetWorthTrend } from "./workspaceTrends";
import { computeWorkspaceRecentTransactions } from "./workspaceTransactions";
import { computeWorkspaceRecurringPayments } from "./workspaceRecurring";
import {
  computeWorkspaceCategoryMonthly,
  computeWorkspaceDailySpend,
} from "./workspaceSpending";
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";

/** The caller's tenant, reshaped into a Phase-1+2+3 `LedgerDashboardData`. */
export async function getWorkspaceDashboard(): Promise<LedgerDashboardData> {
  const ledger = await getWorkspaceLedger();

  const [pnl, liquidity, breakdowns, journalEntries] = await Promise.all([
    getWorkspacePnl(ledger.tenantId, ledger.totals.assetsCents),
    getWorkspaceLiquidity(ledger.tenantId, ledger.balances, ledger.currency),
    getWorkspaceAccountBreakdowns(ledger.tenantId),
    fetchTenantJournalEntries(ledger.tenantId),
  ]);

  const netWorthTrend = computeWorkspaceNetWorthTrend(journalEntries);
  const recentTransactions = computeWorkspaceRecentTransactions(journalEntries);
  const recurringPayments = computeWorkspaceRecurringPayments(journalEntries);
  const categoryMonthly = computeWorkspaceCategoryMonthly(journalEntries);
  const dailySpend = computeWorkspaceDailySpend(journalEntries);

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
      // Not yet ported (Phase 2+): no per-tenant equivalent of SQLite's raw
      // pipeline transaction counts.
      transactionCount: 0,
      rawTransactionCount: 0,
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
    suspenseQueue: [],
    netWorthTrend,
    recentTransactions,
    recurringPayments,
    categoryMonthly,
    dailySpend,
    pipeline: {
      rawCached: 0,
      posted: 0,
      pending: 0,
      zeroAmount: 0,
      unprocessed: 0,
      earliestTransactionDate: null,
      latestTransactionDate: null,
      lastSeenAt: null,
    },
    sourceAccounts: [],
    knownAccounts: [],
    routing: {
      journalCount: 0,
      customRuleCount: 0,
      nzfccFallbackCount: 0,
      suspenseCount: 0,
      suspenseCents: 0,
      classificationRate: null,
    },
    syncState: [],
    error: null,
  };
}
