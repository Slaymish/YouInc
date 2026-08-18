// A hand-crafted, realistic LedgerDashboardData used by the public /demo route
// and the landing widget showcase. No bank, no auth, no SQLite. Amounts in cents.
import type {
  LedgerDashboardData,
  BalanceRow,
  PnlRow,
  NetWorthPoint,
  AccountTotal,
  CreditFacilityRow,
  JournalTransactionRow,
  SourceAccountRow,
  RecurringPayment,
  CategoryMonthPoint,
  DailySpendPoint,
} from "~/components/dashboard/dashboardData";

const ASSETS = 18_900_000; // $189,000
const LIABILITIES = 4_662_000; // $46,620

const balances: BalanceRow[] = [
  // accountType here is the balances domain (first path segment, "Assets"/"Liabilities"
  // per ledger.ts accountType()) — not the lowercase source-account mapping domain used
  // in sourceAccounts below.
  { account: "Assets:Bank:BNZ:Everyday", accountType: "Assets", balanceCents: 850_000, currency: "NZD", isManual: false, liquidityTier: "cash" },
  { account: "Assets:Bank:BNZ:Savings", accountType: "Assets", balanceCents: 2_000_000, currency: "NZD", isManual: false, liquidityTier: "cash" },
  { account: "Assets:Investments:Sharesies:Emergencies", accountType: "Assets", balanceCents: 1_050_000, currency: "NZD", isManual: false, liquidityTier: "semi_liquid" },
  { account: "Assets:Investments:KiwiSaver", accountType: "Assets", balanceCents: 8_000_000, currency: "NZD", isManual: true, liquidityTier: "illiquid" },
  { account: "Assets:Property:Garage", accountType: "Assets", balanceCents: 7_000_000, currency: "NZD", isManual: true, liquidityTier: "illiquid" },
  { account: "Liabilities:CreditCard:BNZ:Advantage", accountType: "Liabilities", balanceCents: 462_000, currency: "NZD", isManual: false, liquidityTier: "illiquid" },
  { account: "Liabilities:Loan:Car", accountType: "Liabilities", balanceCents: 4_200_000, currency: "NZD", isManual: true, liquidityTier: "illiquid" },
];

const creditFacilities: CreditFacilityRow[] = [
  { account: "Liabilities:CreditCard:BNZ:Advantage", accountId: "acc_bnz_visa", limitCents: 1_000_000, drawnCents: 462_000, headroomCents: 538_000, utilization: 0.462 },
];

const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
const pnl: PnlRow[] = MONTHS.map((month, i) => {
  const incomeCents = 880_000 + i * 6_000;
  const expensesCents = 520_000 + ((i % 3) - 1) * 30_000;
  const ebitdaCents = incomeCents - expensesCents;
  return { month, incomeCents, expensesCents, ebitdaCents, ebitdaMargin: ebitdaCents / incomeCents };
});

const netWorthTrend: NetWorthPoint[] = Array.from({ length: 12 }, (_, i) => {
  const month = `2025-${String(i + 1).padStart(2, "0")}`.replace("2025-13", "2026-01");
  const assetsCents = 15_800_000 + i * 260_000;
  const liabilitiesCents = 5_400_000 - i * 62_000;
  return { month, assetsCents, liabilitiesCents, netWorthCents: assetsCents - liabilitiesCents };
});

const incomeBreakdown: AccountTotal[] = [
  { account: "Income:Salary", amountCents: 8_400_000 },
  { account: "Income:Dividends", amountCents: 420_000 },
  { account: "Income:Interest", amountCents: 96_000 },
];

const expenseBreakdown: AccountTotal[] = [
  { account: "Expenses:Housing:Rent", amountCents: 2_400_000 },
  { account: "Expenses:Food:Groceries", amountCents: 1_020_000 },
  { account: "Expenses:Transport", amountCents: 480_000 },
  { account: "Expenses:Software:SaaS", amountCents: 216_000 },
  { account: "Expenses:Health", amountCents: 168_000 },
];

const recentTransactions: JournalTransactionRow[] = [
  { externalId: "s1", transactionDate: "2026-06-28", description: "COUNTDOWN PONSONBY", ruleId: "groceries", amountCents: 8_640, currency: "NZD", postings: [ { account: "Expenses:Food:Groceries", side: "debit", amountCents: 8_640 }, { account: "Assets:Bank:BNZ:Everyday", side: "credit", amountCents: 8_640 } ] },
  { externalId: "s2", transactionDate: "2026-06-27", description: "SPOTIFY", ruleId: "subscriptions", amountCents: 1_499, currency: "NZD", postings: [ { account: "Expenses:Software:SaaS", side: "debit", amountCents: 1_499 }, { account: "Assets:Bank:BNZ:Everyday", side: "credit", amountCents: 1_499 } ] },
  { externalId: "s3", transactionDate: "2026-06-25", description: "SALARY", ruleId: "salary", amountCents: 440_000, currency: "NZD", postings: [ { account: "Assets:Bank:BNZ:Everyday", side: "debit", amountCents: 440_000 }, { account: "Income:Salary", side: "credit", amountCents: 440_000 } ] },
];

const recurringPayments: RecurringPayment[] = [
  { description: "Spotify", account: "Expenses:Software:SaaS", amountCents: 1_499, occurrences: 6, cadenceDays: 30, cadence: "monthly", monthlyEquivalentCents: 1_499, firstDate: "2026-01-27", lastDate: "2026-06-27" },
  { description: "Rent", account: "Expenses:Housing:Rent", amountCents: 200_000, occurrences: 12, cadenceDays: 14, cadence: "fortnightly", monthlyEquivalentCents: 433_333, firstDate: "2026-01-06", lastDate: "2026-06-22" },
  { description: "Gym", account: "Expenses:Health", amountCents: 2_999, occurrences: 6, cadenceDays: 30, cadence: "monthly", monthlyEquivalentCents: 2_999, firstDate: "2026-01-02", lastDate: "2026-06-02" },
];

const categoryMonthly: CategoryMonthPoint[] = MONTHS.flatMap((month) => [
  { account: "Expenses:Housing:Rent", month, amountCents: 400_000 },
  { account: "Expenses:Food:Groceries", month, amountCents: 170_000 },
  { account: "Expenses:Transport", month, amountCents: 80_000 },
]);

const SPEND_PATTERN = [4200, 0, 12800, 3600, 0, 8900, 21500];
const dailySpend: DailySpendPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = `2026-06-${String(i + 1).padStart(2, "0")}`;
  const spendCents = SPEND_PATTERN[i % SPEND_PATTERN.length];
  const incomeCents = i === 24 ? 440_000 : 0;
  return { date, spendCents, incomeCents, netCents: incomeCents - spendCents, count: spendCents > 0 ? 1 : 0 };
});

const sourceAccounts: SourceAccountRow[] = [
  { accountId: "acc_bnz_cash", rawCount: 940, processedCount: 928, pendingCount: 4, firstTransactionDate: "2025-07-01", latestTransactionDate: "2026-06-28", netAmountCents: -1_200_000, currency: "NZD", ledgerAccount: "Assets:Bank:BNZ:Everyday", accountType: "asset", mappingStatus: "configured", creditLimitCents: null },
  { accountId: "acc_bnz_visa", rawCount: 344, processedCount: 312, pendingCount: 2, firstTransactionDate: "2025-07-03", latestTransactionDate: "2026-06-27", netAmountCents: 462_000, currency: "NZD", ledgerAccount: "Liabilities:CreditCard:BNZ:Advantage", accountType: "liability", mappingStatus: "configured", creditLimitCents: 1_000_000 },
];

export const SAMPLE_DASHBOARD: LedgerDashboardData = {
  databasePath: "sample://demo",
  databaseExists: true,
  generatedAt: "2026-06-30T09:00:00.000Z",
  manualBalances: [],
  totals: {
    netWorthCents: ASSETS - LIABILITIES,
    assetsCents: ASSETS,
    liabilitiesCents: LIABILITIES,
    assetLiabilityRatio: ASSETS / LIABILITIES,
    incomeCents: 890_000,
    expensesCents: 520_000,
    ebitdaCents: 370_000,
    ebitdaMargin: 370_000 / 890_000,
    averageMonthlyIncomeCents: 890_000,
    monthlyOverheadCents: 520_000,
    runwayMonths: 18,
    transactionCount: 1_240,
    rawTransactionCount: 1_284,
    cashCents: 2_850_000,
    creditHeadroomCents: 538_000,
    creditLimitCents: 1_000_000,
    availableLiquidityCents: 3_388_000,
  },
  balances,
  creditFacilities,
  pnl,
  incomeBreakdown,
  expenseBreakdown,
  // Three items the rules couldn't place, so the demo can show the sorting task
  // — the interaction people do most. Count and total match routing.suspenseCount
  // / suspenseCents below.
  suspenseQueue: [
    {
      externalId: "sample-suspense-1",
      transactionDate: "2026-06-27",
      description: "ATM WITHDRAWAL CUBA ST",
      amountCents: -2_000,
      direction: "out",
      counterAccount: "Assets:Bank:BNZ:Everyday",
    },
    {
      externalId: "sample-suspense-2",
      transactionDate: "2026-06-24",
      description: "SQ *THE HANGAR COFFEE",
      amountCents: -1_650,
      direction: "out",
      counterAccount: "Assets:Bank:BNZ:Everyday",
    },
    {
      externalId: "sample-suspense-3",
      transactionDate: "2026-06-19",
      description: "TRANSFER FROM J WILSON",
      amountCents: 1_150,
      direction: "in",
      counterAccount: "Assets:Bank:BNZ:Everyday",
    },
  ],
  netWorthTrend,
  recentTransactions,
  recurringPayments,
  categoryMonthly,
  dailySpend,
  pipeline: {
    rawCached: 1_284,
    posted: 1_240,
    pending: 6,
    zeroAmount: 2,
    unprocessed: 0,
    earliestTransactionDate: "2025-07-01",
    latestTransactionDate: "2026-06-28",
    lastSeenAt: "2026-06-30T08:55:00.000Z",
  },
  sourceAccounts,
  knownAccounts: [
    "Assets:Bank:BNZ:Everyday",
    "Assets:Bank:BNZ:Savings",
    "Expenses:Food:Groceries",
    "Expenses:Housing:Rent",
    "Income:Salary",
  ],
  routing: {
    // A healthy, well-maintained sample ledger: a small handful of items
    // still need routing, not a 50-item backlog that reads as "broken" on
    // first look at /demo. Keep customRuleCount + nzfccFallbackCount +
    // suspenseCount == journalCount.
    journalCount: 1_240,
    customRuleCount: 1_027,
    nzfccFallbackCount: 210,
    suspenseCount: 3,
    suspenseCents: 4_800,
    classificationRate: 0.998,
  },
  syncState: [{ key: "last_sync", value: "2026-06-30T08:55:00.000Z", updatedAt: "2026-06-30T08:55:00.000Z" }],
  error: null,
};
