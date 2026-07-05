// Shared `LedgerDashboardData` contract for the dashboard grid + widget
// components. Originally defined in the SQLite-backed `~/server/ledger`
// (the retired single-tenant `/dashboard`); moved here because the grid,
// `renderWidget.tsx`, every read-only widget, the public `/demo` and
// `/widgets` marketing pages, and the multi-tenant `/workspace` route
// (via `server/workspaceDashboard.ts`) all depend on this exact shape and
// needed a home that survives `ledger.ts`'s deletion.
//
// Types that existed only to drive SQLite/CLI mutations (`ManualBalanceInput`,
// `SyncLedgerInput`, `SyncLedgerResult`, `AccountMappingInput`,
// `ClassifyTransactionInput`, `AkahuAccountRow`, `AkahuAccountsResult`) were
// dropped along with the widgets that used them exclusively
// (IngestionWidget, ManualAccountsWidget, SourceSystemsWidget) — those
// capabilities now live in the per-tenant Postgres path (`workspaceLedger.ts`,
// `tenantIngestion.ts`, `akahuConnection.ts`, `tenantRules.ts`) with their own
// types. `SuspenseQueueWidget` was rebuilt on the per-tenant path (Phase 4) —
// see `workspaceSuspenseMath.ts` (read) / `tenantReclassify.ts` (mutation).
import type {
  CategoryMonthPoint,
  DailySpendPoint,
  RecurringCadence,
  RecurringPayment,
} from "~/server/analytics";
import type {
  AccountTotal,
  CreditFacilityRow,
  JournalPosting,
  JournalTransactionRow,
  LiquidityTier,
  NetWorthPoint,
  PnlRow,
} from "~/server/ledgerAggregates";
import type { PipelineHealth } from "~/server/workspacePipelineMath";
import type { RoutingHealth, SuspenseItem } from "~/server/workspaceSuspenseMath";

export type {
  CategoryMonthPoint,
  DailySpendPoint,
  RecurringCadence,
  RecurringPayment,
} from "~/server/analytics";
export type {
  AccountTotal,
  CreditFacilityRow,
  JournalPosting,
  JournalTransactionRow,
  LiquidityTier,
  NetWorthPoint,
  PnlRow,
} from "~/server/ledgerAggregates";
export type { PipelineHealth } from "~/server/workspacePipelineMath";
export type { RoutingHealth, SuspenseItem } from "~/server/workspaceSuspenseMath";

export interface BalanceRow {
  account: string;
  accountType: string;
  balanceCents: number;
  currency: string;
  isManual: boolean;
  liquidityTier: LiquidityTier;
}

export interface ManualBalanceRow {
  account: string;
  balanceCents: number;
  asOfDate: string;
  updatedAt: string;
}

export interface SourceAccountRow {
  accountId: string;
  rawCount: number;
  processedCount: number;
  pendingCount: number;
  firstTransactionDate: string | null;
  latestTransactionDate: string | null;
  netAmountCents: number;
  currency: string;
  ledgerAccount: string;
  accountType: "asset" | "liability";
  mappingStatus: "configured" | "unmapped";
  creditLimitCents: number | null;
}

export interface SyncStateRow {
  key: string;
  value: string;
  updatedAt: string;
}

export interface LedgerDashboardData {
  databasePath: string;
  databaseExists: boolean;
  generatedAt: string;
  manualBalances: ManualBalanceRow[];
  totals: {
    netWorthCents: number;
    assetsCents: number;
    liabilitiesCents: number;
    assetLiabilityRatio: number | null;
    incomeCents: number;
    expensesCents: number;
    ebitdaCents: number;
    ebitdaMargin: number | null;
    averageMonthlyIncomeCents: number;
    monthlyOverheadCents: number;
    runwayMonths: number | null;
    transactionCount: number;
    rawTransactionCount: number;
    cashCents: number;
    creditHeadroomCents: number;
    creditLimitCents: number;
    availableLiquidityCents: number;
  };
  balances: BalanceRow[];
  creditFacilities: CreditFacilityRow[];
  pnl: PnlRow[];
  incomeBreakdown: AccountTotal[];
  expenseBreakdown: AccountTotal[];
  suspenseQueue: SuspenseItem[];
  netWorthTrend: NetWorthPoint[];
  recentTransactions: JournalTransactionRow[];
  recurringPayments: RecurringPayment[];
  categoryMonthly: CategoryMonthPoint[];
  dailySpend: DailySpendPoint[];
  pipeline: PipelineHealth;
  sourceAccounts: SourceAccountRow[];
  knownAccounts: string[];
  routing: RoutingHealth;
  syncState: SyncStateRow[];
  error: string | null;
}
