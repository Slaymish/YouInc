# Marketing Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the app's `/` front door into a real marketing landing page for the hybrid product (self-serve + concierge), with a seeded live demo, a waitlist capture, and a book-a-call CTA — with zero dependency on the future multi-tenant work.

**Architecture:** Everything ships inside the existing TanStack Start frontend (`frontend/`). `/` becomes a composed marketing page (still redirecting authenticated users to `/dashboard`). A new public `/demo` route and a new hero/showcase reuse the **real widget components** by rendering them against a static, hand-crafted `LedgerDashboardData` sample — no auth, no SQLite, no server functions on that path. Waitlist signups post to one thin server function that writes to a dedicated `leads` SQLite database (mirroring the existing `auth.ts` pattern). Book-a-call is a configurable external link.

**Tech Stack:** TanStack Start (React 19 + Nitro), TypeScript, `better-sqlite3`, `zod` (new), Vitest (unit/integration), Playwright (new, one E2E smoke). CSS with explicit light-first palette (no dark coupling).

## Global Constraints

- Package manager is **pnpm**. If `pnpm install` fails with `ECONNREFUSED 127.0.0.1:8080`, re-run with proxy vars stripped: `env -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY -u https_proxy -u http_proxy -u all_proxy pnpm install`.
- **Typecheck is part of build**: `pnpm build` runs `vite build && tsc --noEmit`. Unit tests: `pnpm test` (Vitest, node env, app Vite plugins intentionally not loaded — so tests cover **pure logic and server modules only**, never React rendering).
- All money is integer **cents** end to end (`*Cents` fields). Locale `en-NZ`, currency `NZD`. Format only at the edge via `src/components/widgets/format.ts`.
- Server-only modules must be imported **lazily** (`await import(...)`) inside server-function handlers so native/SQLite code never enters the client bundle. Type-only imports from server modules must use `import type`.
- Immutable data patterns only (spread to update; never mutate inputs). Files ≤ 800 lines, functions ≤ 50 lines, no `console.log` in shipped client code (server-side `console.info`/`console.error` for logs is fine).
- Landing page palette is **light-first** and uses explicit colors, not the app's `data-theme` tokens. Widget areas (demo/showcase) force `data-theme="light"` while mounted.
- Product copy constants (headline, prices, booking URL) live in `src/components/marketing/config.ts` — no magic strings scattered across components (DRY).
- Exact placeholder values (confirm later, do not block on them): booking URL default `https://cal.com/youinc/intro`; self-serve price `NZD $15`/mo; concierge price `From NZD $149`/mo.

---

### Task 1: Marketing config module

**Files:**
- Create: `frontend/src/components/marketing/config.ts`
- Test: `frontend/src/components/marketing/config.test.ts`

**Interfaces:**
- Produces: `resolveBookingUrl(env: { VITE_YOUINC_BOOKING_URL?: string }): string`; `BOOKING_URL: string`; `PRICING` (const object); `PRODUCT` (const object with `name`, `heroHeadline`, `heroSub`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/marketing/config.test.ts
import { describe, expect, it } from "vitest";
import { resolveBookingUrl, PRICING, PRODUCT } from "./config";

describe("resolveBookingUrl", () => {
  it("returns the env override when present", () => {
    expect(resolveBookingUrl({ VITE_YOUINC_BOOKING_URL: "https://cal.com/me/x" })).toBe(
      "https://cal.com/me/x",
    );
  });

  it("falls back to the default placeholder when unset", () => {
    expect(resolveBookingUrl({})).toBe("https://cal.com/youinc/intro");
  });
});

describe("pricing + product copy", () => {
  it("prices self-serve concretely and concierge as 'from'", () => {
    expect(PRICING.selfServe.price).toBe("NZD $15");
    expect(PRICING.concierge.price).toBe("From NZD $149");
  });

  it("names the product", () => {
    expect(PRODUCT.name).toBe("YouInc");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test src/components/marketing/config.test.ts`
Expected: FAIL — cannot resolve `./config`.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/components/marketing/config.ts
// Central marketing copy + config. No magic strings in components.

const DEFAULT_BOOKING_URL = "https://cal.com/youinc/intro";

export function resolveBookingUrl(env: { VITE_YOUINC_BOOKING_URL?: string }): string {
  const value = env.VITE_YOUINC_BOOKING_URL?.trim();
  return value && value.length > 0 ? value : DEFAULT_BOOKING_URL;
}

// import.meta.env is Vite's client-exposed env; only VITE_* keys are inlined.
export const BOOKING_URL: string = resolveBookingUrl(
  import.meta.env as { VITE_YOUINC_BOOKING_URL?: string },
);

export const PRODUCT = {
  name: "YouInc",
  heroEyebrow: "Personal ERP · Live open banking",
  heroHeadline: "Run yourself like a company.",
  heroSub:
    "Connect your bank, watch it sync live, and get a dashboard built exactly for how you think about money. Need a widget that doesn't exist yet? I build it for you.",
} as const;

export const PRICING = {
  demo: {
    name: "Demo",
    price: "Free",
    cta: "Start free",
    features: ["Sample data, read-only", "Full widget gallery", "No sign-up to look around"],
  },
  selfServe: {
    name: "Self-serve",
    price: "NZD $15",
    cadence: "/mo",
    cta: "Join the waitlist",
    features: [
      "Your bank, live via Akahu",
      "All pre-built widgets",
      "Customize order & layout",
      "Email support",
    ],
  },
  concierge: {
    name: "Concierge",
    price: "From NZD $149",
    cadence: "/mo",
    cta: "Book a call",
    features: [
      "Everything in Self-serve",
      "Bespoke widgets & integrations, built for you",
      "Direct line — book a call anytime",
    ],
  },
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test src/components/marketing/config.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/marketing/config.ts frontend/src/components/marketing/config.test.ts
git commit -m "feat: marketing config + pricing/copy constants"
```

---

### Task 2: Seeded demo dashboard payload

**Files:**
- Create: `frontend/src/components/marketing/sampleDashboard.ts`
- Test: `frontend/src/components/marketing/sampleDashboard.test.ts`

**Interfaces:**
- Consumes: `LedgerDashboardData` and nested types (`BalanceRow`, `PnlRow`, `NetWorthPoint`, `AccountTotal`, `CreditFacilityRow`, `JournalTransactionRow`, `SourceAccountRow`, `RoutingHealth`, `PipelineHealth`, `SyncStateRow`, `RecurringPayment`, `CategoryMonthPoint`, `DailySpendPoint`) — all exported from `~/server/ledger` (imported as `import type`, so no server code is bundled).
- Produces: `SAMPLE_DASHBOARD: LedgerDashboardData`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/marketing/sampleDashboard.test.ts
import { describe, expect, it } from "vitest";
import { SAMPLE_DASHBOARD } from "./sampleDashboard";

const isInt = (n: number) => Number.isInteger(n);

describe("SAMPLE_DASHBOARD", () => {
  it("looks like a populated ledger (widgets have data to render)", () => {
    expect(SAMPLE_DASHBOARD.databaseExists).toBe(true);
    expect(SAMPLE_DASHBOARD.error).toBeNull();
    expect(SAMPLE_DASHBOARD.balances.length).toBeGreaterThan(0);
    expect(SAMPLE_DASHBOARD.pnl.length).toBeGreaterThan(0);
    expect(SAMPLE_DASHBOARD.netWorthTrend.length).toBeGreaterThan(0);
    expect(SAMPLE_DASHBOARD.expenseBreakdown.length).toBeGreaterThan(0);
    expect(SAMPLE_DASHBOARD.dailySpend.length).toBeGreaterThan(0);
  });

  it("keeps the net-worth identity and integer cents", () => {
    const t = SAMPLE_DASHBOARD.totals;
    expect(t.netWorthCents).toBe(t.assetsCents - t.liabilitiesCents);
    expect(isInt(t.netWorthCents)).toBe(true);
    expect(SAMPLE_DASHBOARD.balances.every((b) => isInt(b.balanceCents))).toBe(true);
    expect(SAMPLE_DASHBOARD.dailySpend.every((d) => isInt(d.spendCents))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test src/components/marketing/sampleDashboard.test.ts`
Expected: FAIL — cannot resolve `./sampleDashboard`.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/components/marketing/sampleDashboard.ts
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
} from "~/server/ledger";

const ASSETS = 18_900_000; // $189,000
const LIABILITIES = 4_662_000; // $46,620

const balances: BalanceRow[] = [
  { account: "Assets:Bank:BNZ:Everyday", accountType: "asset", balanceCents: 850_000, currency: "NZD", isManual: false, liquidityTier: "cash" },
  { account: "Assets:Bank:BNZ:Savings", accountType: "asset", balanceCents: 2_000_000, currency: "NZD", isManual: false, liquidityTier: "cash" },
  { account: "Assets:Investments:Sharesies:Emergencies", accountType: "asset", balanceCents: 1_050_000, currency: "NZD", isManual: false, liquidityTier: "semi_liquid" },
  { account: "Assets:Investments:KiwiSaver", accountType: "asset", balanceCents: 8_000_000, currency: "NZD", isManual: true, liquidityTier: "illiquid" },
  { account: "Assets:Property:Garage", accountType: "asset", balanceCents: 7_000_000, currency: "NZD", isManual: true, liquidityTier: "illiquid" },
  { account: "Liabilities:CreditCard:BNZ:Advantage", accountType: "liability", balanceCents: 462_000, currency: "NZD", isManual: false, liquidityTier: "illiquid" },
  { account: "Liabilities:Loan:Car", accountType: "liability", balanceCents: 4_200_000, currency: "NZD", isManual: true, liquidityTier: "illiquid" },
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
  suspenseQueue: [],
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
    journalCount: 1_240,
    customRuleCount: 980,
    nzfccFallbackCount: 210,
    suspenseCount: 50,
    suspenseCents: 84_000,
    classificationRate: 0.96,
  },
  syncState: [{ key: "last_sync", value: "2026-06-30T08:55:00.000Z", updatedAt: "2026-06-30T08:55:00.000Z" }],
  error: null,
};
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd frontend && pnpm test src/components/marketing/sampleDashboard.test.ts && pnpm build`
Expected: tests PASS; build PASS. If `tsc` reports a missing/extra field on any nested type, fix the literal to match the type in `src/server/ledger.ts` / `src/server/analytics.ts` exactly, then re-run.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/marketing/sampleDashboard.ts frontend/src/components/marketing/sampleDashboard.test.ts
git commit -m "feat: seeded sample dashboard payload for demo + showcase"
```

---

### Task 3: Extract widget renderer for reuse (refactor)

Move the widget-rendering switch out of `DashboardGrid.tsx` so the demo and showcase can reuse it. No behavior change.

**Files:**
- Create: `frontend/src/components/dashboard/renderWidget.tsx`
- Modify: `frontend/src/components/dashboard/DashboardGrid.tsx` (remove the moved code + now-unused widget imports; import from `renderWidget`)

**Interfaces:**
- Produces: `METRIC_IDS: Set<string>`; `renderWidgetContent(id: WidgetId, dashboard: LedgerDashboardData, onNavigate: (view: AttentionTargetView) => void): React.ReactNode`.
- Consumes (in DashboardGrid): the two symbols above.

- [ ] **Step 1: Create the shared renderer module**

Create `frontend/src/components/dashboard/renderWidget.tsx` containing exactly the widget imports (lines 19–47 of the current `DashboardGrid.tsx`), the `METRIC_IDS` set, and the `renderWidgetContent` function — now exported:

```tsx
// frontend/src/components/dashboard/renderWidget.tsx
import type { WidgetId } from "./widgets";
import type { LedgerDashboardData } from "~/server/ledger";
import type { AttentionTargetView } from "../widgets/derive";

import { AttentionWidget } from "../widgets/AttentionWidget";
import { ControlBriefWidget } from "../widgets/ControlBriefWidget";
import { MetricWidget } from "../widgets/MetricWidget";
import { OperatingStatementWidget } from "../widgets/OperatingStatementWidget";
import { LedgerConfidenceWidget } from "../widgets/LedgerConfidenceWidget";
import { IngestionWidget } from "../widgets/IngestionWidget";
import { BalanceSheetWidget } from "../widgets/BalanceSheetWidget";
import { ManualAccountsWidget } from "../widgets/ManualAccountsWidget";
import { JournalWidget } from "../widgets/JournalWidget";
import { SourceSystemsWidget } from "../widgets/SourceSystemsWidget";
import { LiquidityWidget, CreditFacilityWidget } from "../widgets/LiquidityWidget";
import { ExpenseBreakdownWidget } from "../widgets/ExpenseBreakdownWidget";
import { IncomeBreakdownWidget } from "../widgets/IncomeBreakdownWidget";
import { SuspenseQueueWidget } from "../widgets/SuspenseQueueWidget";
import { MonthPulseWidget } from "../widgets/MonthPulseWidget";
import { AssetMixWidget } from "../widgets/AssetMixWidget";
import { RollingAverageWidget } from "../widgets/RollingAverageWidget";
import { NetWorthTrendWidget } from "../widgets/NetWorthTrendWidget";
import { RunwayProjectionWidget } from "../widgets/RunwayProjectionWidget";
import { RecurringWidget } from "../widgets/RecurringWidget";
import { NetWorthVelocityWidget } from "../widgets/NetWorthVelocityWidget";
import { IncomeConcentrationWidget } from "../widgets/IncomeConcentrationWidget";
import { CashflowWaterfallWidget } from "../widgets/CashflowWaterfallWidget";
import { SpendingAnomaliesWidget } from "../widgets/SpendingAnomaliesWidget";
import { SpendCalendarWidget } from "../widgets/SpendCalendarWidget";

export const METRIC_IDS = new Set<string>([
  "metric-net-worth",
  "metric-runway",
  "metric-burn",
  "metric-margin",
  "metric-assets",
  "metric-liabilities",
  "metric-available-liquidity",
]);

export function renderWidgetContent(
  id: WidgetId,
  dashboard: LedgerDashboardData,
  onNavigate: (view: AttentionTargetView) => void,
) {
  if (METRIC_IDS.has(id)) {
    return <MetricWidget id={id} dashboard={dashboard} />;
  }
  switch (id) {
    case "attention":
      return <AttentionWidget dashboard={dashboard} onNavigate={onNavigate} />;
    case "control-brief":
      return <ControlBriefWidget dashboard={dashboard} />;
    case "operating-statement":
      return <OperatingStatementWidget dashboard={dashboard} />;
    case "ledger-confidence":
      return <LedgerConfidenceWidget dashboard={dashboard} />;
    case "ingestion":
      return <IngestionWidget dashboard={dashboard} />;
    case "balance-sheet":
      return <BalanceSheetWidget dashboard={dashboard} />;
    case "manual-accounts":
      return <ManualAccountsWidget dashboard={dashboard} />;
    case "journal":
      return <JournalWidget dashboard={dashboard} />;
    case "source-systems":
      return <SourceSystemsWidget dashboard={dashboard} />;
    case "liquidity":
      return <LiquidityWidget dashboard={dashboard} />;
    case "credit-facility":
      return <CreditFacilityWidget dashboard={dashboard} />;
    case "expense-breakdown":
      return <ExpenseBreakdownWidget dashboard={dashboard} />;
    case "income-breakdown":
      return <IncomeBreakdownWidget dashboard={dashboard} />;
    case "suspense-queue":
      return <SuspenseQueueWidget dashboard={dashboard} />;
    case "month-pulse":
      return <MonthPulseWidget dashboard={dashboard} />;
    case "asset-mix":
      return <AssetMixWidget dashboard={dashboard} />;
    case "rolling-burn":
      return <RollingAverageWidget dashboard={dashboard} />;
    case "net-worth-trend":
      return <NetWorthTrendWidget dashboard={dashboard} />;
    case "runway-projection":
      return <RunwayProjectionWidget dashboard={dashboard} />;
    case "recurring":
      return <RecurringWidget dashboard={dashboard} />;
    case "net-worth-velocity":
      return <NetWorthVelocityWidget dashboard={dashboard} />;
    case "income-concentration":
      return <IncomeConcentrationWidget dashboard={dashboard} />;
    case "cashflow-waterfall":
      return <CashflowWaterfallWidget dashboard={dashboard} />;
    case "spending-anomalies":
      return <SpendingAnomaliesWidget dashboard={dashboard} />;
    case "spend-calendar":
      return <SpendCalendarWidget dashboard={dashboard} />;
    default:
      return null;
  }
}
```

- [ ] **Step 2: Update `DashboardGrid.tsx` to consume the shared module**

In `frontend/src/components/dashboard/DashboardGrid.tsx`:
- Delete the widget component imports currently on lines 19–47.
- Delete the local `METRIC_IDS` constant (lines 50–58) and the local `renderWidgetContent` function (lines 60–122).
- Keep `import type { AttentionTargetView } from "../widgets/derive";` only if still referenced; it is passed via `renderWidgetContent`'s callback, which now lives in `renderWidget.tsx`, so remove it from `DashboardGrid.tsx` if unused.
- Add: `import { METRIC_IDS, renderWidgetContent } from "./renderWidget";`
- Leave everything else (the `DashboardGrid` component body, which already calls `renderWidgetContent(...)` and `METRIC_IDS.has(...)`) unchanged.

- [ ] **Step 3: Typecheck + run existing tests (no behavior change)**

Run: `cd frontend && pnpm build && pnpm test`
Expected: build PASS (no unused-import or type errors); existing tests (`views.test.ts`, `derive.attention.test.ts`) PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/renderWidget.tsx frontend/src/components/dashboard/DashboardGrid.tsx
git commit -m "refactor: extract renderWidgetContent into shared module"
```

---

### Task 4: Waitlist leads store + validation

Server-only module that validates and persists signups, mirroring the `auth.ts` SQLite pattern.

**Files:**
- Modify: `frontend/package.json` (add `zod`)
- Create: `frontend/src/server/leads.ts`
- Test: `frontend/src/server/leads.test.ts`

**Interfaces:**
- Produces: `recordLead(input: unknown): { ok: true }` (throws `Response` 400 on invalid email); `WaitlistInput` type. Reads env `YOUINC_LEADS_DB_PATH` (default `../data/youinc-leads.sqlite3`), optional `YOUINC_LEADS_WEBHOOK_URL`.

- [ ] **Step 1: Add zod**

Run: `cd frontend && pnpm add zod`
Expected: `zod` appears under `dependencies` in `frontend/package.json`.

- [ ] **Step 2: Write the failing test**

```ts
// frontend/src/server/leads.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "leads-"));
  dbPath = path.join(dir, "leads.sqlite3");
  process.env.YOUINC_LEADS_DB_PATH = dbPath;
});

afterEach(() => {
  delete process.env.YOUINC_LEADS_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
  vi.resetModules();
});

async function freshModule() {
  vi.resetModules();
  return import("./leads");
}

function countRows(): number {
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare("SELECT COUNT(*) AS n FROM leads").get() as { n: number };
  db.close();
  return row.n;
}

describe("recordLead", () => {
  it("stores a valid signup", async () => {
    const { recordLead } = await freshModule();
    expect(recordLead({ email: "a@b.com", source: "hero" })).toEqual({ ok: true });
    expect(countRows()).toBe(1);
  });

  it("is idempotent on duplicate email (upsert, not a second row)", async () => {
    const { recordLead } = await freshModule();
    recordLead({ email: "dup@b.com", source: "hero" });
    recordLead({ email: "dup@b.com", source: "pricing" });
    expect(countRows()).toBe(1);
  });

  it("rejects an invalid email with a 400 Response", async () => {
    const { recordLead } = await freshModule();
    expect(() => recordLead({ email: "not-an-email" })).toThrow();
    expect(countRows()).toBe(0);
  });

  it("silently drops honeypot submissions without storing", async () => {
    const { recordLead } = await freshModule();
    expect(recordLead({ email: "bot@b.com", company: "Acme Spam" })).toEqual({ ok: true });
    expect(countRows()).toBe(0);
  });
});
```

Add `import { vi } from "vitest";` at the top of the test file.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && pnpm test src/server/leads.test.ts`
Expected: FAIL — cannot resolve `./leads`.

- [ ] **Step 4: Write minimal implementation**

```ts
// frontend/src/server/leads.ts
// Server-only waitlist store. Mirrors the auth.ts SQLite pattern: dedicated DB
// file, WAL, lazy singleton. The `leads` table is the source of truth; owner
// notification is best-effort and never fails a signup.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { z } from "zod";

const WaitlistSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  interest: z.enum(["self-serve", "concierge"]).optional(),
  source: z.string().max(60).optional(),
  userAgent: z.string().max(400).optional(),
  // Honeypot: real users never fill this. Bots do.
  company: z.string().optional(),
});

export type WaitlistInput = z.infer<typeof WaitlistSchema>;

function resolveLeadsDbPath(): string {
  const configured = process.env.YOUINC_LEADS_DB_PATH ?? "../data/youinc-leads.sqlite3";
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

let dbInstance: Database.Database | null = null;

function db(): Database.Database {
  if (dbInstance) return dbInstance;
  const dbPath = resolveLeadsDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT,
      interest TEXT,
      source TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(email)
    );
  `);
  dbInstance = database;
  return database;
}

function notify(lead: WaitlistInput): void {
  const url = process.env.YOUINC_LEADS_WEBHOOK_URL;
  console.info(`[waitlist] new signup: ${lead.email} (${lead.source ?? "unknown"})`);
  if (!url) return;
  // Fire-and-forget; a failed webhook must never fail the signup.
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: lead.email, source: lead.source, interest: lead.interest }),
  }).catch((err) => console.error("[waitlist] webhook failed", err));
}

export function recordLead(input: unknown): { ok: true } {
  const parsed = WaitlistSchema.safeParse(input);
  if (!parsed.success) {
    throw new Response("Please enter a valid email address.", { status: 400 });
  }
  const lead = parsed.data;
  // Honeypot filled → pretend success, store nothing.
  if (lead.company && lead.company.trim().length > 0) {
    return { ok: true };
  }
  db()
    .prepare(
      `INSERT INTO leads (email, name, interest, source, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         interest = excluded.interest,
         source = excluded.source,
         user_agent = excluded.user_agent,
         created_at = excluded.created_at`,
    )
    .run(
      lead.email,
      lead.name ?? null,
      lead.interest ?? null,
      lead.source ?? null,
      lead.userAgent ?? null,
      Date.now(),
    );
  notify(lead);
  return { ok: true };
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd frontend && pnpm test src/server/leads.test.ts && pnpm build`
Expected: 4 tests PASS; build PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/server/leads.ts frontend/src/server/leads.test.ts
git commit -m "feat: waitlist leads store with zod validation + honeypot"
```

---

### Task 5: Waitlist form + server function

**Files:**
- Create: `frontend/src/components/marketing/WaitlistForm.tsx`

**Interfaces:**
- Consumes: `recordLead` from `~/server/leads` (lazy import inside the server fn).
- Produces: `WaitlistForm` component (props `{ source: string; onDone?: () => void }`); exported server fn `joinWaitlist`.

- [ ] **Step 1: Write the component + server fn**

```tsx
// frontend/src/components/marketing/WaitlistForm.tsx
import { useState } from "react";
import { createServerFn } from "@tanstack/react-start";

export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .handler(async ({ data }) => {
    const { recordLead } = await import("~/server/leads");
    return recordLead(data);
  });

interface WaitlistFormProps {
  source: string;
  onDone?: () => void;
}

export function WaitlistForm({ source, onDone }: WaitlistFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const company = String(form.get("company") ?? ""); // honeypot
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Please enter a valid email address.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      await joinWaitlist({
        data: { email, company, source, userAgent: navigator.userAgent },
      });
      setStatus("done");
      onDone?.();
    } catch {
      setError("Something went wrong — please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="waitlist-done" role="status">
        <p>You're on the list. Take the product for a spin while you wait:</p>
        <a className="mk-btn mk-btn--primary" href="/demo">
          Open the live demo →
        </a>
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit} noValidate>
      <label className="visually-hidden" htmlFor={`wl-email-${source}`}>
        Email address
      </label>
      <input
        id={`wl-email-${source}`}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@email.com"
        required
      />
      {/* Honeypot: hidden from humans, tempting to bots. */}
      <input
        className="visually-hidden"
        tabIndex={-1}
        autoComplete="off"
        name="company"
        aria-hidden="true"
      />
      <button className="mk-btn mk-btn--primary" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Joining…" : "Start free →"}
      </button>
      {error ? (
        <p className="waitlist-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && pnpm build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/marketing/WaitlistForm.tsx
git commit -m "feat: waitlist form + joinWaitlist server function"
```

---

### Task 6: Read-only demo board + curated widget set

**Files:**
- Create: `frontend/src/components/marketing/demoWidgets.ts`
- Create: `frontend/src/components/marketing/DemoBoard.tsx`
- Create: `frontend/src/components/marketing/marketing.css`
- Test: `frontend/src/components/marketing/demoWidgets.test.ts`

**Interfaces:**
- Consumes: `renderWidgetContent` from `~/components/dashboard/renderWidget`; `WIDGET_MAP`, `WidgetId` from `~/components/dashboard/widgets`; `SAMPLE_DASHBOARD`.
- Produces: `DEMO_WIDGET_IDS: WidgetId[]` (curated, excludes mutating/data-entry widgets); `SHOWCASE_WIDGET_IDS: WidgetId[]`; `DemoBoard` component; `useLightTheme()` hook.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/marketing/demoWidgets.test.ts
import { describe, expect, it } from "vitest";
import { DEMO_WIDGET_IDS, SHOWCASE_WIDGET_IDS } from "./demoWidgets";
import { WIDGET_MAP } from "../dashboard/widgets";

const MUTATING = new Set(["ingestion", "manual-accounts", "source-systems"]);

describe("curated widget id lists", () => {
  it("only reference real widgets", () => {
    for (const id of [...DEMO_WIDGET_IDS, ...SHOWCASE_WIDGET_IDS]) {
      expect(WIDGET_MAP.has(id)).toBe(true);
    }
  });

  it("never expose mutating/data-entry widgets in the public demo", () => {
    for (const id of DEMO_WIDGET_IDS) {
      expect(MUTATING.has(id)).toBe(false);
    }
  });

  it("keep the showcase small", () => {
    expect(SHOWCASE_WIDGET_IDS.length).toBeLessThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test src/components/marketing/demoWidgets.test.ts`
Expected: FAIL — cannot resolve `./demoWidgets`.

- [ ] **Step 3: Write the curated lists**

```ts
// frontend/src/components/marketing/demoWidgets.ts
import type { WidgetId } from "../dashboard/widgets";

// Presentational widgets only — no ingestion/manual-accounts/source-systems,
// which trigger session-gated mutations that would 401 on the public demo.
export const DEMO_WIDGET_IDS: WidgetId[] = [
  "metric-net-worth",
  "metric-runway",
  "metric-burn",
  "metric-margin",
  "control-brief",
  "net-worth-trend",
  "operating-statement",
  "expense-breakdown",
  "income-breakdown",
  "asset-mix",
  "spend-calendar",
  "recurring",
];

export const SHOWCASE_WIDGET_IDS: WidgetId[] = [
  "metric-net-worth",
  "metric-runway",
  "net-worth-trend",
  "spend-calendar",
  "expense-breakdown",
  "asset-mix",
];
```

- [ ] **Step 4: Write the DemoBoard + light-theme hook**

```tsx
// frontend/src/components/marketing/DemoBoard.tsx
import { useEffect } from "react";
import { WIDGET_MAP, type WidgetId } from "../dashboard/widgets";
import { renderWidgetContent } from "../dashboard/renderWidget";
import { SAMPLE_DASHBOARD } from "./sampleDashboard";
import { DEMO_WIDGET_IDS } from "./demoWidgets";

/** Forces light theme while mounted so widget tokens stay consistent on public pages. */
export function useLightTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme");
    html.setAttribute("data-theme", "light");
    return () => {
      if (prev) html.setAttribute("data-theme", prev);
      else html.removeAttribute("data-theme");
    };
  }, []);
}

const noop = () => {};

export function DemoBoard({ ids = DEMO_WIDGET_IDS }: { ids?: WidgetId[] }) {
  return (
    <div className="demo-board">
      {ids.map((id) => (
        <section className="demo-panel" key={id}>
          <h3 className="demo-panel__title">{WIDGET_MAP.get(id)?.label ?? id}</h3>
          <div className="demo-panel__body">
            {renderWidgetContent(id, SAMPLE_DASHBOARD, noop)}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create the marketing stylesheet (base + demo board + shared button/utility classes)**

```css
/* frontend/src/components/marketing/marketing.css */
/* Landing palette — explicit, light-first, not coupled to app data-theme tokens. */
.mk {
  --mk-paper: #fbfbf9;
  --mk-ink: #111111;
  --mk-soft: #55534d;
  --mk-line: #e3e3dd;
  --mk-accent: #12a150;
  --mk-card: #ffffff;
  --mk-serif: Georgia, "Times New Roman", serif;
  --mk-sans: ui-sans-serif, system-ui, -apple-system, sans-serif;
  background: var(--mk-paper);
  color: var(--mk-ink);
  font-family: var(--mk-sans);
}

.visually-hidden {
  position: absolute !important;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0);
  white-space: nowrap; border: 0;
}

.mk-btn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-family: var(--mk-sans); font-size: 0.95rem; font-weight: 600;
  padding: 0.7rem 1.2rem; border-radius: 6px; text-decoration: none;
  border: 1px solid transparent; cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
}
.mk-btn--primary { background: var(--mk-ink); color: #fff; }
.mk-btn--primary:hover { transform: translateY(-2px); box-shadow: 0 10px 24px -10px rgba(0,0,0,.5); }
.mk-btn--ghost { background: transparent; color: var(--mk-ink); border-bottom: 2px solid var(--mk-ink); border-radius: 0; padding: 0.5rem 0; }
.mk-btn:focus-visible { outline: 3px solid #6ea8fe; outline-offset: 2px; }

/* Demo board */
.demo-board {
  display: grid; grid-template-columns: repeat(12, 1fr); gap: 1rem;
  padding: 1.5rem; max-width: 1200px; margin: 0 auto;
}
.demo-panel {
  grid-column: span 6; background: var(--mk-card);
  border: 1px solid var(--mk-line); border-radius: 12px; padding: 1rem 1.2rem;
  box-shadow: 0 12px 30px -18px rgba(40,40,30,.4);
}
.demo-panel__title { margin: 0 0 0.5rem; font-family: var(--mk-sans); font-size: 0.75rem; letter-spacing: .08em; text-transform: uppercase; color: var(--mk-soft); }
@media (max-width: 900px) { .demo-panel { grid-column: span 12; } }

/* Waitlist form */
.waitlist-form { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
.waitlist-form input[type="email"] {
  font: inherit; padding: 0.7rem 0.9rem; border: 1px solid var(--mk-line);
  border-radius: 6px; min-width: 15rem; background: #fff;
}
.waitlist-error { color: #d4553f; font-size: 0.85rem; width: 100%; margin: 0.3rem 0 0; }
.waitlist-done { font-family: var(--mk-sans); }
```

- [ ] **Step 6: Run tests + typecheck**

Run: `cd frontend && pnpm test src/components/marketing/demoWidgets.test.ts && pnpm build`
Expected: 3 tests PASS; build PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/marketing/demoWidgets.ts frontend/src/components/marketing/demoWidgets.test.ts frontend/src/components/marketing/DemoBoard.tsx frontend/src/components/marketing/marketing.css
git commit -m "feat: read-only demo board + curated widget sets + marketing base css"
```

---

### Task 7: Public `/demo` route + session gate

**Files:**
- Create: `frontend/src/routes/demo.tsx`
- Modify: `frontend/src/start.ts:5` (add `/demo` to `PUBLIC_PATHS`)

**Interfaces:**
- Consumes: `DemoBoard`, `useLightTheme` from `~/components/marketing/DemoBoard`; `BOOKING_URL` from `~/components/marketing/config`.

- [ ] **Step 1: Add `/demo` to the public path allowlist**

In `frontend/src/start.ts`, change line 5 from:

```ts
const PUBLIC_PATHS = new Set(["/", LOGIN_PATH]);
```

to:

```ts
const PUBLIC_PATHS = new Set(["/", "/demo", LOGIN_PATH]);
```

- [ ] **Step 2: Create the demo route**

```tsx
// frontend/src/routes/demo.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { DemoBoard, useLightTheme } from "~/components/marketing/DemoBoard";
import { BOOKING_URL } from "~/components/marketing/config";
import "~/components/dashboard/dashboard.css";
import "~/components/marketing/marketing.css";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
});

function DemoPage() {
  useLightTheme();
  return (
    <main className="mk">
      <header className="demo-banner">
        <div>
          <strong>Live demo</strong> — sample data, read-only. This is exactly what your
          dashboard looks like once your bank is connected.
        </div>
        <nav className="demo-banner__cta">
          <Link className="mk-btn mk-btn--ghost" to="/">
            ← Back
          </Link>
          <a className="mk-btn mk-btn--primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            Book a call
          </a>
        </nav>
      </header>
      <DemoBoard />
    </main>
  );
}
```

- [ ] **Step 3: Add the demo banner styles to `marketing.css`**

Append to `frontend/src/components/marketing/marketing.css`:

```css
.demo-banner {
  display: flex; justify-content: space-between; align-items: center; gap: 1rem;
  flex-wrap: wrap; padding: 1rem 1.5rem; max-width: 1200px; margin: 0 auto;
  border-bottom: 1px solid var(--mk-line); font-family: var(--mk-sans); font-size: 0.9rem;
}
.demo-banner__cta { display: flex; gap: 0.8rem; align-items: center; }
```

- [ ] **Step 4: Verify route + gate manually**

Run: `cd frontend && pnpm build`
Expected: build PASS; TanStack regenerates `src/routeTree.gen.ts` to include `/demo` (this file is generated on build/dev — commit its update).

Then, without a session cookie, `/demo` must render (not redirect to `/login`). Verify with the dev server:

Run: `cd frontend && pnpm dev` then in another shell:
`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/demo`
Expected: `200` (not `302`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/demo.tsx frontend/src/start.ts frontend/src/routeTree.gen.ts frontend/src/components/marketing/marketing.css
git commit -m "feat: public /demo route rendering seeded widgets"
```

---

### Task 8: Hero, live-proof strip, and how-it-works

**Files:**
- Create: `frontend/src/components/marketing/Hero.tsx`
- Create: `frontend/src/components/marketing/LiveProofStrip.tsx`
- Create: `frontend/src/components/marketing/HowItWorks.tsx`
- Modify: `frontend/src/components/marketing/marketing.css` (append hero/strip/steps styles)

**Interfaces:**
- Consumes: `PRODUCT`, `BOOKING_URL` from `./config`; `WaitlistForm` from `./WaitlistForm`.
- Produces: `Hero`, `LiveProofStrip`, `HowItWorks` components.

- [ ] **Step 1: Write the Hero (ported from the approved A×C mockup)**

```tsx
// frontend/src/components/marketing/Hero.tsx
import { PRODUCT, BOOKING_URL } from "./config";
import { WaitlistForm } from "./WaitlistForm";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero__copy">
        <p className="hero__eyebrow">{PRODUCT.heroEyebrow}</p>
        <h1 id="hero-heading" className="hero__headline">
          Run yourself like a <em>company.</em>
        </h1>
        <p className="hero__sub">{PRODUCT.heroSub}</p>
        <div className="hero__ctas">
          <WaitlistForm source="hero" />
          <a className="mk-btn mk-btn--ghost" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            Book a call
          </a>
        </div>
      </div>
      <div className="hero__cards" aria-hidden="true">
        <div className="fw fw--1">
          <span className="live-tag"><span className="live-dot" />LIVE</span>
          <span className="fw__lab">Net worth</span>
          <span className="fw__big">$142,380</span>
          <span className="fw__up">▲ 4.2% this month</span>
        </div>
        <div className="fw fw--2">
          <span className="fw__lab">Runway</span>
          <span className="fw__big">18 mo</span>
          <svg className="fw__spark" viewBox="0 0 100 20" preserveAspectRatio="none">
            <polyline points="0,16 20,14 40,15 60,9 80,7 100,4" fill="none" stroke="#12a150" strokeWidth="2" />
          </svg>
        </div>
        <div className="fw fw--3">
          <span className="fw__lab">Cashflow</span>
          <span className="fw__big">+$3,240</span>
        </div>
        <div className="fw fw--4">
          <span className="fw__lab">Top expense</span>
          <span className="fw__big">$1,204</span>
          <span className="fw__down">Rent · 27%</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write LiveProofStrip and HowItWorks**

```tsx
// frontend/src/components/marketing/LiveProofStrip.tsx
export function LiveProofStrip() {
  return (
    <section className="proof" aria-label="Supported banks">
      <span className="live-tag"><span className="live-dot" />Synced live via Akahu</span>
      <span className="proof__banks">BNZ · ANZ · ASB · Kiwibank · Westpac · +more</span>
    </section>
  );
}
```

```tsx
// frontend/src/components/marketing/HowItWorks.tsx
const STEPS = [
  { n: "01", title: "Connect your bank", body: "Securely link your accounts through Akahu — New Zealand's open-banking layer. Read-only, revoke anytime." },
  { n: "02", title: "It syncs & categorizes, live", body: "Transactions flow in, get matched to a double-entry ledger, and stay current automatically." },
  { n: "03", title: "Read your dashboard", body: "Net worth, runway, cashflow and more — arranged exactly how you think about money." },
];

export function HowItWorks() {
  return (
    <section className="steps" aria-labelledby="how-heading">
      <h2 id="how-heading" className="section-heading">How it works</h2>
      <ol className="steps__list">
        {STEPS.map((s) => (
          <li className="step" key={s.n}>
            <span className="step__n">{s.n}</span>
            <h3 className="step__title">{s.title}</h3>
            <p className="step__body">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 3: Append hero/strip/steps styles to `marketing.css`**

```css
/* Section rhythm */
.section-heading { font-family: var(--mk-serif); font-weight: 400; font-size: clamp(1.8rem, 3vw, 2.6rem); letter-spacing: -.02em; margin: 0 0 2rem; }
.mk section { padding: clamp(3rem, 6vw, 6rem) clamp(1.25rem, 5vw, 4rem); max-width: 1200px; margin: 0 auto; }

/* Hero */
.hero { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 2rem; align-items: center; position: relative; min-height: 34rem; }
.hero__eyebrow { font-size: 0.7rem; letter-spacing: .2em; text-transform: uppercase; color: var(--mk-soft); margin: 0 0 0.8rem; }
.hero__headline { font-family: var(--mk-serif); font-weight: 400; font-size: clamp(2.6rem, 6vw, 4.5rem); line-height: .96; letter-spacing: -.025em; margin: 0 0 1rem; }
.hero__headline em { font-style: italic; }
.hero__sub { font-size: 1.05rem; color: var(--mk-soft); line-height: 1.6; max-width: 32rem; margin: 0 0 1.6rem; }
.hero__ctas { display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap; }
.hero__cards { position: relative; height: 100%; min-height: 26rem; }

.fw { position: absolute; background: var(--mk-card); border: 1px solid var(--mk-line); border-radius: 12px; padding: 0.85rem 1rem; font-size: 0.7rem; line-height: 1.35; display: flex; flex-direction: column; gap: 0.15rem; box-shadow: 0 18px 40px -12px rgba(40,40,30,.28), 0 4px 12px -4px rgba(40,40,30,.12); }
.fw__lab { font-size: 0.6rem; letter-spacing: .1em; text-transform: uppercase; color: var(--mk-soft); }
.fw__big { font-size: 1.4rem; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.fw__up { color: var(--mk-accent); font-weight: 600; }
.fw__down { color: #d4553f; font-weight: 600; }
.fw__spark { width: 100%; height: 20px; margin-top: 0.3rem; }
.fw--1 { top: 1rem; right: 3rem; width: 10rem; transform: rotate(3.5deg); }
.fw--2 { top: 9rem; right: 11rem; width: 9rem; transform: rotate(-4deg); z-index: 2; }
.fw--3 { top: 15rem; right: 2rem; width: 8rem; transform: rotate(2.5deg); }
.fw--4 { top: 21rem; right: 9rem; width: 8.5rem; transform: rotate(-2deg); }

.live-tag { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.6rem; font-weight: 700; letter-spacing: .08em; color: var(--mk-accent); }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--mk-accent); }
@keyframes mk-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
.live-dot { animation: mk-pulse 1.7s infinite; }
@media (prefers-reduced-motion: reduce) { .live-dot { animation: none; } .mk-btn:hover { transform: none; } }

@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr; }
  .hero__cards { display: none; }
}

/* Proof strip */
.proof { display: flex; gap: 1.2rem; align-items: center; justify-content: center; flex-wrap: wrap; border-block: 1px solid var(--mk-line); font-size: 0.85rem; color: var(--mk-soft); padding-block: 1.2rem !important; }
.proof__banks { letter-spacing: .02em; }

/* Steps */
.steps__list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
.step__n { font-family: var(--mk-serif); font-size: 2rem; color: var(--mk-accent); }
.step__title { font-size: 1.1rem; margin: 0.5rem 0; }
.step__body { color: var(--mk-soft); line-height: 1.55; margin: 0; }
@media (max-width: 780px) { .steps__list { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/marketing/Hero.tsx frontend/src/components/marketing/LiveProofStrip.tsx frontend/src/components/marketing/HowItWorks.tsx frontend/src/components/marketing/marketing.css
git commit -m "feat: hero, live-proof strip, how-it-works sections"
```

---

### Task 9: Widget showcase + bespoke section

**Files:**
- Create: `frontend/src/components/marketing/WidgetShowcase.tsx`
- Create: `frontend/src/components/marketing/BespokeSection.tsx`
- Modify: `frontend/src/components/marketing/marketing.css` (append showcase/bespoke styles)

**Interfaces:**
- Consumes: `SHOWCASE_WIDGET_IDS` from `./demoWidgets`; `renderWidgetContent` from `../dashboard/renderWidget`; `WIDGET_MAP` from `../dashboard/widgets`; `SAMPLE_DASHBOARD` from `./sampleDashboard`; `BOOKING_URL` from `./config`.
- Produces: `WidgetShowcase`, `BespokeSection` components.

- [ ] **Step 1: Write WidgetShowcase (real widgets, tilted bento)**

```tsx
// frontend/src/components/marketing/WidgetShowcase.tsx
import { Link } from "@tanstack/react-router";
import { WIDGET_MAP } from "../dashboard/widgets";
import { renderWidgetContent } from "../dashboard/renderWidget";
import { SAMPLE_DASHBOARD } from "./sampleDashboard";
import { SHOWCASE_WIDGET_IDS } from "./demoWidgets";

const noop = () => {};

export function WidgetShowcase() {
  return (
    <section className="showcase" aria-labelledby="showcase-heading">
      <h2 id="showcase-heading" className="section-heading">
        Build your dashboard from any of these — or more.
      </h2>
      <div className="showcase__grid">
        {SHOWCASE_WIDGET_IDS.map((id, i) => (
          <div className={`showcase__card showcase__card--${i % 4}`} key={id}>
            <h3 className="showcase__label">{WIDGET_MAP.get(id)?.label ?? id}</h3>
            <div className="showcase__widget">{renderWidgetContent(id, SAMPLE_DASHBOARD, noop)}</div>
          </div>
        ))}
      </div>
      <Link className="mk-btn mk-btn--primary" to="/demo">
        Explore the full live demo →
      </Link>
    </section>
  );
}
```

```tsx
// frontend/src/components/marketing/BespokeSection.tsx
import { BOOKING_URL } from "./config";

export function BespokeSection() {
  return (
    <section className="bespoke" aria-labelledby="bespoke-heading">
      <p className="hero__eyebrow">What nobody else offers</p>
      <h2 id="bespoke-heading" className="section-heading">
        Missing a widget? A custom integration? <em>I build it for you.</em>
      </h2>
      <p className="bespoke__body">
        Most tools hand you a rigid template and wish you luck. YouInc is different: tell me how
        you actually think about your money, and I'll build the widget, report, or integration to
        match — fast. You get a dashboard that fits you, not the other way around.
      </p>
      <a className="mk-btn mk-btn--primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
        Book a call →
      </a>
    </section>
  );
}
```

- [ ] **Step 2: Append showcase/bespoke styles to `marketing.css`**

```css
/* Showcase */
.showcase__grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1.2rem; margin-bottom: 2.5rem; }
.showcase__card { background: var(--mk-card); border: 1px solid var(--mk-line); border-radius: 14px; padding: 1rem 1.1rem; box-shadow: 0 16px 36px -20px rgba(40,40,30,.4); transition: transform 200ms ease; }
.showcase__card:hover { transform: translateY(-4px) rotate(0deg); }
.showcase__card--0 { grid-column: span 2; transform: rotate(-1.5deg); }
.showcase__card--1 { grid-column: span 2; transform: rotate(1.5deg); }
.showcase__card--2 { grid-column: span 2; transform: rotate(-1deg); }
.showcase__card--3 { grid-column: span 3; }
.showcase__card:nth-child(n+5) { grid-column: span 3; }
.showcase__label { font-family: var(--mk-sans); font-size: 0.7rem; letter-spacing: .08em; text-transform: uppercase; color: var(--mk-soft); margin: 0 0 0.6rem; }
@media (max-width: 900px) { .showcase__grid { grid-template-columns: 1fr; } .showcase__card, .showcase__card--0, .showcase__card--1, .showcase__card--2, .showcase__card--3 { grid-column: span 1; transform: none; } }

/* Bespoke */
.bespoke { text-align: center; }
.bespoke .section-heading em { font-style: italic; color: var(--mk-accent); }
.bespoke__body { max-width: 42rem; margin: 0 auto 1.8rem; color: var(--mk-soft); line-height: 1.65; font-size: 1.05rem; }
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/marketing/WidgetShowcase.tsx frontend/src/components/marketing/BespokeSection.tsx frontend/src/components/marketing/marketing.css
git commit -m "feat: widget showcase + bespoke concierge section"
```

---

### Task 10: Pricing, FAQ, footer, and page assembly

**Files:**
- Create: `frontend/src/components/marketing/Pricing.tsx`
- Create: `frontend/src/components/marketing/Faq.tsx`
- Create: `frontend/src/components/marketing/MarketingFooter.tsx`
- Create: `frontend/src/components/marketing/MarketingPage.tsx`
- Modify: `frontend/src/routes/index.tsx` (render `MarketingPage`; keep the authenticated→`/dashboard` redirect)
- Delete: `frontend/src/styles/landing.css` (only `index.tsx` imports it; superseded by `marketing.css`)
- Modify: `frontend/src/components/marketing/marketing.css` (append pricing/faq/footer/nav styles)

**Interfaces:**
- Consumes: `PRICING`, `PRODUCT`, `BOOKING_URL` from `./config`; `WaitlistForm`; `Hero`, `LiveProofStrip`, `HowItWorks`, `WidgetShowcase`, `BespokeSection`; `useLightTheme` from `./DemoBoard`.
- Produces: `MarketingPage` component.

- [ ] **Step 1: Write Pricing**

```tsx
// frontend/src/components/marketing/Pricing.tsx
import { BOOKING_URL, PRICING } from "./config";
import { WaitlistForm } from "./WaitlistForm";

export function Pricing() {
  return (
    <section className="pricing" aria-labelledby="pricing-heading">
      <h2 id="pricing-heading" className="section-heading">Pricing</h2>
      <div className="pricing__grid">
        <article className="tier">
          <h3 className="tier__name">{PRICING.demo.name}</h3>
          <p className="tier__price">{PRICING.demo.price}</p>
          <ul className="tier__features">
            {PRICING.demo.features.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <a className="mk-btn mk-btn--ghost" href="/demo">Open the demo →</a>
        </article>

        <article className="tier tier--featured">
          <h3 className="tier__name">{PRICING.selfServe.name}</h3>
          <p className="tier__price">{PRICING.selfServe.price}<span className="tier__cadence">{PRICING.selfServe.cadence}</span></p>
          <ul className="tier__features">
            {PRICING.selfServe.features.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <WaitlistForm source="pricing" />
        </article>

        <article className="tier">
          <h3 className="tier__name">{PRICING.concierge.name}</h3>
          <p className="tier__price">{PRICING.concierge.price}<span className="tier__cadence">{PRICING.concierge.cadence}</span></p>
          <ul className="tier__features">
            {PRICING.concierge.features.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <a className="mk-btn mk-btn--primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            {PRICING.concierge.cta}
          </a>
        </article>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write Faq and MarketingFooter**

```tsx
// frontend/src/components/marketing/Faq.tsx
const FAQS = [
  { q: "Is my bank data safe?", a: "Connections are read-only and made through Akahu, New Zealand's regulated open-banking provider. You can revoke access at any time, and YouInc never stores your bank login." },
  { q: "Where is my data stored?", a: "Your ledger is yours. The self-serve tier keeps it in an isolated per-account store; nothing is shared between users." },
  { q: "What is Akahu?", a: "Akahu is New Zealand's open-finance hub — it's the secure bridge that lets apps read your transactions with your consent, without handing over passwords." },
  { q: "Can I get a widget that doesn't exist yet?", a: "Yes — that's the Concierge tier. Book a call, tell me what you need, and I build it for you." },
];

export function Faq() {
  return (
    <section className="faq" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="section-heading">Questions</h2>
      <dl className="faq__list">
        {FAQS.map((f) => (
          <div className="faq__item" key={f.q}>
            <dt className="faq__q">{f.q}</dt>
            <dd className="faq__a">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
```

```tsx
// frontend/src/components/marketing/MarketingFooter.tsx
import { PRODUCT } from "./config";

export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <span>{PRODUCT.name}</span>
      <span className="mk-footer__note">Run yourself like a company.</span>
    </footer>
  );
}
```

- [ ] **Step 3: Write MarketingPage (composition + nav + final CTA)**

```tsx
// frontend/src/components/marketing/MarketingPage.tsx
import { Link } from "@tanstack/react-router";
import { PRODUCT, BOOKING_URL } from "./config";
import { useLightTheme } from "./DemoBoard";
import { Hero } from "./Hero";
import { LiveProofStrip } from "./LiveProofStrip";
import { HowItWorks } from "./HowItWorks";
import { WidgetShowcase } from "./WidgetShowcase";
import { BespokeSection } from "./BespokeSection";
import { Pricing } from "./Pricing";
import { WaitlistForm } from "./WaitlistForm";
import { Faq } from "./Faq";
import { MarketingFooter } from "./MarketingFooter";
import "./marketing.css";
import "../dashboard/dashboard.css"; // widget styles for the showcase

export function MarketingPage() {
  useLightTheme();
  return (
    <div className="mk">
      <header className="mk-nav">
        <span className="mk-nav__logo">{PRODUCT.name}</span>
        <nav className="mk-nav__links" aria-label="Main navigation">
          <a href="#showcase-heading">Widgets</a>
          <a href="#pricing-heading">Pricing</a>
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Custom builds</a>
          <Link className="mk-nav__signin" to="/login">Sign in</Link>
        </nav>
      </header>
      <main>
        <Hero />
        <LiveProofStrip />
        <HowItWorks />
        <WidgetShowcase />
        <BespokeSection />
        <Pricing />
        <section className="final-cta" aria-labelledby="final-heading">
          <h2 id="final-heading" className="section-heading">Start running yourself like a company.</h2>
          <WaitlistForm source="final-cta" />
        </section>
        <Faq />
      </main>
      <MarketingFooter />
    </div>
  );
}
```

- [ ] **Step 4: Rewire `index.tsx`**

Replace the body of `frontend/src/routes/index.tsx` with (keeping the existing `checkSession` redirect logic, dropping the old inline landing markup, `useTheme`, and the `landing.css` import):

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { MarketingPage } from "~/components/marketing/MarketingPage";

const checkSession = createServerFn({ method: "GET" }).handler(async () => {
  const { hasValidSession } = await import("~/server/auth");
  return { authenticated: hasValidSession() };
});

export const Route = createFileRoute("/")({
  loader: async () => {
    const { authenticated } = await checkSession();
    if (authenticated) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: MarketingPage,
});
```

Then delete the dead stylesheet:

```bash
git rm frontend/src/styles/landing.css
```

- [ ] **Step 5: Append pricing/faq/footer/nav/final-cta styles to `marketing.css`**

```css
/* Nav */
.mk-nav { display: flex; justify-content: space-between; align-items: center; padding: 1.1rem clamp(1.25rem, 5vw, 4rem); max-width: 1200px; margin: 0 auto; border-bottom: 1px solid var(--mk-line); }
.mk-nav__logo { font-weight: 800; letter-spacing: .02em; font-size: 1.1rem; }
.mk-nav__links { display: flex; gap: 1.4rem; align-items: center; font-size: 0.9rem; }
.mk-nav__links a { color: var(--mk-ink); text-decoration: none; opacity: .85; }
.mk-nav__links a:hover { opacity: 1; }
.mk-nav__signin { border: 1px solid var(--mk-ink); padding: 0.4rem 0.9rem; border-radius: 5px; }

/* Pricing */
.pricing__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
.tier { background: var(--mk-card); border: 1px solid var(--mk-line); border-radius: 14px; padding: 1.8rem 1.6rem; display: flex; flex-direction: column; gap: 1rem; }
.tier--featured { border-color: var(--mk-ink); box-shadow: 0 20px 44px -22px rgba(0,0,0,.45); }
.tier__name { font-family: var(--mk-sans); font-size: 0.8rem; letter-spacing: .1em; text-transform: uppercase; color: var(--mk-soft); margin: 0; }
.tier__price { font-family: var(--mk-serif); font-size: 2.2rem; margin: 0; }
.tier__cadence { font-family: var(--mk-sans); font-size: 0.9rem; color: var(--mk-soft); }
.tier__features { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; color: var(--mk-soft); font-size: 0.92rem; }
.tier__features li::before { content: "✓ "; color: var(--mk-accent); font-weight: 700; }
.tier { margin-top: auto; }
@media (max-width: 900px) { .pricing__grid { grid-template-columns: 1fr; } }

/* Final CTA + FAQ + footer */
.final-cta { text-align: center; }
.final-cta .waitlist-form { justify-content: center; }
.faq__list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem 2.5rem; }
.faq__q { font-weight: 700; margin-bottom: 0.4rem; }
.faq__a { margin: 0; color: var(--mk-soft); line-height: 1.55; }
@media (max-width: 780px) { .faq__list { grid-template-columns: 1fr; } }
.mk-footer { display: flex; justify-content: space-between; padding: 2rem clamp(1.25rem, 5vw, 4rem); border-top: 1px solid var(--mk-line); color: var(--mk-soft); font-size: 0.85rem; max-width: 1200px; margin: 0 auto; }
```

- [ ] **Step 6: Typecheck + full unit suite + manual visual check**

Run: `cd frontend && pnpm build && pnpm test`
Expected: build PASS; all unit tests PASS.

Then `cd frontend && pnpm dev` and open `http://localhost:3000/` — verify: hero with floating live cards, proof strip, steps, real widgets rendering in the showcase, bespoke section, three pricing tiers (self-serve featured), final CTA form, FAQ, footer. Submit the hero form with a test email → success state offers the demo link. Confirm no console errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/marketing/ frontend/src/routes/index.tsx frontend/src/styles/landing.css
git commit -m "feat: assemble marketing landing page at / (pricing, faq, footer, nav)"
```

---

### Task 11: End-to-end smoke test of the critical flow

Add Playwright and one deterministic E2E covering the landing → waitlist → demo path and the book-a-call link.

**Files:**
- Modify: `frontend/package.json` (add `@playwright/test` devDep + `test:e2e` script)
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/landing.spec.ts`
- Modify: `frontend/.gitignore` (ignore `playwright-report/`, `test-results/`)

**Interfaces:**
- Consumes: the running app (dev server) at `http://localhost:3000`.

- [ ] **Step 1: Install Playwright**

Run: `cd frontend && pnpm add -D @playwright/test && pnpm exec playwright install chromium`
Expected: `@playwright/test` under `devDependencies`; Chromium downloaded.

- [ ] **Step 2: Add the `test:e2e` script**

In `frontend/package.json` `scripts`, add:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 3: Write the Playwright config**

```ts
// frontend/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { YOUINC_LEADS_DB_PATH: "./.e2e-leads.sqlite3" },
  },
});
```

- [ ] **Step 4: Write the E2E spec**

```ts
// frontend/e2e/landing.spec.ts
import { test, expect } from "@playwright/test";

test("landing hero renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("book-a-call links to the scheduler in a new tab", async ({ page }) => {
  await page.goto("/");
  const bookLink = page.getByRole("link", { name: "Book a call" }).first();
  await expect(bookLink).toHaveAttribute("href", /cal\.com|calendly\.com/);
  await expect(bookLink).toHaveAttribute("target", "_blank");
});

test("waitlist signup succeeds and offers the demo", async ({ page }) => {
  await page.goto("/");
  const form = page.locator(".hero .waitlist-form");
  await form.getByPlaceholder("you@email.com").fill("e2e@example.com");
  await form.getByRole("button", { name: /start free/i }).click();
  await expect(page.getByText(/you're on the list/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /open the live demo/i })).toBeVisible();
});

test("public demo renders real widgets without auth and hides mutation controls", async ({ page }) => {
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/demo$/); // not redirected to /login
  await expect(page.getByRole("heading", { name: "Net Worth" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Customize" })).toHaveCount(0);
});
```

- [ ] **Step 5: Ignore Playwright artifacts**

Append to `frontend/.gitignore`:

```
playwright-report/
test-results/
.e2e-leads.sqlite3*
```

- [ ] **Step 6: Run the E2E suite**

Run: `cd frontend && pnpm test:e2e`
Expected: 4 tests PASS. If the waitlist test fails because the placeholder booking URL doesn't match `cal.com|calendly.com`, update the regex to match the configured `VITE_YOUINC_BOOKING_URL`, or set that env var to your real scheduler before running.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/playwright.config.ts frontend/e2e/landing.spec.ts frontend/.gitignore
git commit -m "test: e2e smoke for landing → waitlist → demo flow"
```

---

## Self-Review

**Spec coverage:**
- Visual direction (A×C hybrid, light-first, floating live cards) → Task 8 (Hero + CSS). ✓
- Section structure (hero, proof, how-it-works, showcase, bespoke, pricing, final CTA + FAQ, footer) → Tasks 8–10. ✓
- CTA behavior — waitlist + demo → Tasks 5, 6, 7; book-a-call link-out → Tasks 1 (BOOKING_URL), 8/9/10. ✓
- Pricing (self-serve priced, concierge "from") → Task 1 (PRICING) + Task 10 (Pricing). ✓
- `/` evolution + auth redirect preserved → Task 10. ✓
- Public `/demo` with seeded data, no auth surface, mutations excluded → Tasks 2, 6, 7. ✓
- Waitlist server fn + `leads` table + best-effort notify + honeypot + validation → Tasks 4, 5. ✓
- Real rendered widgets (not screenshots) via shared renderer → Task 3 + Tasks 6, 9. ✓
- a11y/perf/security (semantic HTML, focus states, reduced-motion, honeypot, CSRF via existing middleware, no client secrets) → Tasks 4, 8, 10. ✓
- Testing: unit (config, sample, leads, curated ids), integration (leads DB), E2E (critical flow) → Tasks 1, 2, 4, 6, 11. ✓

**Placeholder scan:** No "TBD"/"implement later" in code steps; the three business open items (real booking URL, final price numbers, notification transport) are represented by concrete, working defaults (`https://cal.com/youinc/intro`, `NZD $15` / `From NZD $149`, console + optional webhook) and flagged for later confirmation — none block implementation. ✓

**Type consistency:** `recordLead(input: unknown)` (Task 4) is called by `joinWaitlist` (Task 5) with an object matching `WaitlistSchema`. `renderWidgetContent(id, dashboard, onNavigate)` and `METRIC_IDS` signatures are identical across Tasks 3, 6, 9. `SAMPLE_DASHBOARD: LedgerDashboardData` (Task 2) is consumed by `renderWidgetContent`'s `dashboard` param. `DEMO_WIDGET_IDS`/`SHOWCASE_WIDGET_IDS: WidgetId[]` (Task 6) match `WIDGET_MAP` keys. `BOOKING_URL`/`PRICING`/`PRODUCT` (Task 1) consumed unchanged in Tasks 8–10. ✓

## Open items carried from the spec (confirm, non-blocking)
1. Real scheduler URL → set `VITE_YOUINC_BOOKING_URL`.
2. Final price numbers → edit `PRICING` in `config.ts`.
3. Signup notification transport → set `YOUINC_LEADS_WEBHOOK_URL` (or wire SMTP/Resend later).
