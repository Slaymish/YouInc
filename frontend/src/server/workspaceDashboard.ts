// Assembles the local ledger into the shared dashboard payload.
import { getWorkspaceLedger } from "./workspaceLedger";
import { getWorkspacePnl } from "./workspacePnl";
import { getWorkspaceLiquidity } from "./workspaceLiquidity";
import { getWorkspaceAccountBreakdowns } from "./workspaceBreakdowns";
import { fetchJournalEntries } from "./workspaceJournal";
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

/** The caller's workspace, reshaped into a Phase-1+2+3+4 `LedgerDashboardData`. */
export async function getWorkspaceDashboard(): Promise<LedgerDashboardData> {
  const ledger = await getWorkspaceLedger();

  const [pnl, liquidity, breakdowns, journalEntries, pipeline] = await Promise.all([
    getWorkspacePnl(ledger.workspaceId, ledger.totals.assetsCents),
    getWorkspaceLiquidity(ledger.workspaceId, ledger.balances, ledger.currency),
    getWorkspaceAccountBreakdowns(ledger.workspaceId),
    fetchJournalEntries(ledger.workspaceId),
    getWorkspacePipelineHealth(ledger.workspaceId),
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
    databasePath: "local SQLite",
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
