# Quiz-Funnel Onboarding — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an anonymous, client-side quiz that doubles as manual-account entry, ends in a personalized net-worth "reveal" with no account required, then converts to a saved account that persists the entered balances — plus a reframed pricing page.

**Architecture:** The quiz + reveal are pure client-side React on a public route (`/start`); answers live in `localStorage` and survive the signup navigation. Three dependency-free modules (quiz model, quiz→ledger mapping, reveal-dashboard builder) hold all logic and are unit-tested under vitest's node environment. Account creation reuses the existing multi-step signup + `/onboarding` tenant flow; after the tenant exists, the persisted quiz balances are replayed through the existing tenant-scoped `upsertWorkspaceBalance` DAL.

**Tech Stack:** TanStack Start (React 19), TanStack Router file routes, `createServerFn`, Supabase (auth + Postgres/RLS), vitest (node env, co-located `*.test.ts`), Playwright (`e2e/`), pnpm.

## Global Constraints

- Money is integer **cents** end-to-end; assets positive, liabilities negative. Format only at the edge with `src/components/widgets/format.ts` (`formatMoney`, `shortMoney`). Locale `en-NZ`, currency **NZD**.
- Unit-tested modules must be **dependency-free** (no `~/` alias, no Supabase, no React) — vitest runs in `environment: "node"` with no Vite/React plugins. Put logic in pure modules; keep localStorage/React in separate files.
- Server functions must **lazily** `import("~/server/...")` inside the handler so native/Supabase code never enters the client bundle.
- `upsertWorkspaceBalance({account, balanceCents, asOfDate?})` derives the tenant from the RLS session — **never pass a tenant id**. `account` must contain `":"`.
- No global route allowlist exists; a route is public simply by having a loader that does not call `getAccountState`/`checkAuthed`.
- Honesty guardrails: the reveal shows **only the user's own numbers** — no fabricated or comparative ("top X%") claims.
- localStorage convention: versioned `youinc-*` key, `JSON.stringify` payload, `try/catch` on both read and write, and a `is…(parsed): parsed is T` type guard on read.
- `config.test.ts` pins the price strings `"NZD $15"`, `"From NZD $149"`, `"$0"` and `PRICING.demo.name !== PRICING.free.name`. Change copy and these tests together, deliberately.
- Commit after every task (frequent commits). Do not `git add -A`; stage only the files the task names, to avoid sweeping unrelated working-tree changes.

## File Structure

```
src/components/onboarding/            # new feature dir
  quizModel.ts        # pure: types, constants, parse/validate (no localStorage)
  quizModel.test.ts
  quizStorage.ts      # thin localStorage wrappers over quizModel
  quizToLedger.ts     # pure: quiz entries → manual balance inputs
  quizToLedger.test.ts
  buildRevealDashboard.ts       # pure: quiz state → LedgerDashboardData
  buildRevealDashboard.test.ts
  QuizFlow.tsx        # client state machine (goal → balances → reveal)
  GoalScreen.tsx
  BalanceScreen.tsx
  QuizProgress.tsx
  RevealScreen.tsx    # bespoke reveal using derive/format (not the app grid)
  onboarding-quiz.css
src/routes/start.tsx  # public route mounting QuizFlow
src/routes/onboarding.tsx          # MODIFY: persist quiz balances after createTenant
src/components/marketing/config.ts # MODIFY: pricing copy reframe
src/components/marketing/config.test.ts        # MODIFY: update pinned copy
src/components/marketing/PricingTable.tsx      # MODIFY: drop Demo column
src/components/marketing/film/PricingLedger.tsx# MODIFY: drop Demo row / reorder
src/components/marketing/StartFreeCta.tsx      # MODIFY: link to /start
e2e/quiz-funnel.spec.ts            # new e2e
```

---

## Task 1: Quiz model + storage

**Files:**
- Create: `src/components/onboarding/quizModel.ts`
- Test: `src/components/onboarding/quizModel.test.ts`
- Create: `src/components/onboarding/quizStorage.ts`

**Interfaces:**
- Produces: `QuizGoal`, `QuizCategory`, `QuizEntry`, `QuizState` types; `QUIZ_STORAGE_KEY`; `QUIZ_GOALS`, `QUIZ_CATEGORIES` (ordered metadata); `emptyQuizState()`; `parseQuizState(raw: string | null): QuizState | null`; `serializeQuizState(state: QuizState): string`. Storage: `loadQuizState(): QuizState`, `persistQuizState(state: QuizState): void`, `clearQuizState(): void`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/onboarding/quizModel.test.ts
import { describe, expect, it } from "vitest";
import {
  emptyQuizState,
  parseQuizState,
  serializeQuizState,
  QUIZ_CATEGORIES,
  type QuizState,
} from "./quizModel";

describe("quizModel", () => {
  it("round-trips a valid state through serialize/parse", () => {
    const state: QuizState = {
      version: 1,
      goal: "net-worth",
      entries: [{ category: "everyday", cents: 420000 }],
    };
    expect(parseQuizState(serializeQuizState(state))).toEqual(state);
  });

  it("returns null for null, malformed JSON, and wrong-shape input", () => {
    expect(parseQuizState(null)).toBeNull();
    expect(parseQuizState("{not json")).toBeNull();
    expect(parseQuizState(JSON.stringify({ version: 1 }))).toBeNull();
    expect(parseQuizState(JSON.stringify({ version: 99, goal: "net-worth", entries: [] }))).toBeNull();
  });

  it("rejects entries with unknown categories or non-integer cents", () => {
    expect(parseQuizState(JSON.stringify({ version: 1, goal: "net-worth", entries: [{ category: "boat", cents: 1 }] }))).toBeNull();
    expect(parseQuizState(JSON.stringify({ version: 1, goal: "net-worth", entries: [{ category: "everyday", cents: 1.5 }] }))).toBeNull();
  });

  it("exposes an ordered category list with account paths and asset/liability kind", () => {
    const everyday = QUIZ_CATEGORIES.find((c) => c.id === "everyday");
    const mortgage = QUIZ_CATEGORIES.find((c) => c.id === "mortgage");
    expect(everyday?.account).toBe("Assets:Bank:Everyday");
    expect(everyday?.kind).toBe("asset");
    expect(mortgage?.account).toBe("Liabilities:Mortgage");
    expect(mortgage?.kind).toBe("liability");
  });

  it("emptyQuizState has no goal and no entries", () => {
    expect(emptyQuizState()).toEqual({ version: 1, goal: null, entries: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/onboarding/quizModel.test.ts`
Expected: FAIL — cannot resolve `./quizModel`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/onboarding/quizModel.ts
// Pure, dependency-free (no localStorage, no React) so vitest (node env) can
// import it directly. localStorage lives in quizStorage.ts.

export const QUIZ_STORAGE_KEY = "youinc-quiz-v1";
export const QUIZ_VERSION = 1;

export type QuizGoal = "net-worth" | "debt" | "save" | "see-it-all";
export type QuizCategory =
  | "everyday" | "savings" | "kiwisaver" | "investments"
  | "home" | "vehicle" | "mortgage" | "loan" | "creditcard";

export type LiquidityTier = "cash" | "semi_liquid" | "illiquid";

export interface QuizCategoryMeta {
  id: QuizCategory;
  label: string;            // question label, e.g. "Everyday account"
  hint: string;             // helper copy
  account: string;          // namespaced ledger account path
  kind: "asset" | "liability";
  liquidityTier: LiquidityTier;
  sliderMaxCents: number;   // sensible NZ upper bound for the slider
  sliderStepCents: number;
}

export interface QuizGoalMeta { id: QuizGoal; label: string; }

export interface QuizEntry { category: QuizCategory; cents: number; } // positive magnitude
export interface QuizState { version: number; goal: QuizGoal | null; entries: QuizEntry[]; }

export const QUIZ_GOALS: readonly QuizGoalMeta[] = [
  { id: "net-worth", label: "Know my true net worth" },
  { id: "debt", label: "Get on top of debt" },
  { id: "save", label: "Save for something big" },
  { id: "see-it-all", label: "Just see it all in one place" },
];

export const QUIZ_CATEGORIES: readonly QuizCategoryMeta[] = [
  { id: "everyday",    label: "Everyday account",      hint: "Your main transaction account", account: "Assets:Bank:Everyday",       kind: "asset",     liquidityTier: "cash",       sliderMaxCents: 5_000_000,   sliderStepCents: 10_000 },
  { id: "savings",     label: "Savings",               hint: "Rainy-day or term deposits",     account: "Assets:Bank:Savings",        kind: "asset",     liquidityTier: "cash",       sliderMaxCents: 20_000_000,  sliderStepCents: 50_000 },
  { id: "kiwisaver",   label: "KiwiSaver",             hint: "Your current balance",           account: "Assets:Investments:KiwiSaver",kind: "asset",    liquidityTier: "semi_liquid",sliderMaxCents: 30_000_000,  sliderStepCents: 50_000 },
  { id: "investments", label: "Shares & funds",        hint: "Managed funds, shares, crypto",  account: "Assets:Investments:Shares",  kind: "asset",     liquidityTier: "semi_liquid",sliderMaxCents: 50_000_000,  sliderStepCents: 50_000 },
  { id: "home",        label: "Home",                  hint: "Estimated market value",         account: "Assets:Property:Home",       kind: "asset",     liquidityTier: "illiquid",   sliderMaxCents: 200_000_000, sliderStepCents: 500_000 },
  { id: "vehicle",     label: "Vehicle",               hint: "Cars, boats, etc.",              account: "Assets:Property:Vehicle",    kind: "asset",     liquidityTier: "illiquid",   sliderMaxCents: 20_000_000,  sliderStepCents: 50_000 },
  { id: "mortgage",    label: "Mortgage",              hint: "What you still owe",             account: "Liabilities:Mortgage",       kind: "liability", liquidityTier: "illiquid",   sliderMaxCents: 200_000_000, sliderStepCents: 500_000 },
  { id: "loan",        label: "Loans",                 hint: "Personal or student loans",      account: "Liabilities:Loan",           kind: "liability", liquidityTier: "semi_liquid",sliderMaxCents: 20_000_000,  sliderStepCents: 50_000 },
  { id: "creditcard",  label: "Credit card / BNPL",    hint: "Current balance owing",          account: "Liabilities:CreditCard",     kind: "liability", liquidityTier: "cash",       sliderMaxCents: 5_000_000,   sliderStepCents: 10_000 },
];

const GOAL_IDS = new Set<string>(QUIZ_GOALS.map((g) => g.id));
const CATEGORY_IDS = new Set<string>(QUIZ_CATEGORIES.map((c) => c.id));

export function emptyQuizState(): QuizState {
  return { version: QUIZ_VERSION, goal: null, entries: [] };
}

export function serializeQuizState(state: QuizState): string {
  return JSON.stringify(state);
}

function isEntry(value: unknown): value is QuizEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.category === "string" &&
    CATEGORY_IDS.has(e.category) &&
    typeof e.cents === "number" &&
    Number.isInteger(e.cents) &&
    e.cents >= 0
  );
}

export function parseQuizState(raw: string | null): QuizState | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const s = parsed as Record<string, unknown>;
  if (s.version !== QUIZ_VERSION) return null;
  if (!(s.goal === null || (typeof s.goal === "string" && GOAL_IDS.has(s.goal)))) return null;
  if (!Array.isArray(s.entries) || !s.entries.every(isEntry)) return null;
  return { version: QUIZ_VERSION, goal: s.goal as QuizGoal | null, entries: s.entries as QuizEntry[] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/onboarding/quizModel.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add the localStorage wrapper (no new test — covered by e2e)**

```ts
// src/components/onboarding/quizStorage.ts
import { emptyQuizState, parseQuizState, serializeQuizState, QUIZ_STORAGE_KEY, type QuizState } from "./quizModel";

export function loadQuizState(): QuizState {
  try {
    return parseQuizState(localStorage.getItem(QUIZ_STORAGE_KEY)) ?? emptyQuizState();
  } catch {
    return emptyQuizState();
  }
}

export function persistQuizState(state: QuizState): void {
  try {
    localStorage.setItem(QUIZ_STORAGE_KEY, serializeQuizState(state));
  } catch {
    /* ignore quota / unavailable */
  }
}

export function clearQuizState(): void {
  try {
    localStorage.removeItem(QUIZ_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/onboarding/quizModel.ts src/components/onboarding/quizModel.test.ts src/components/onboarding/quizStorage.ts
git commit -m "feat: quiz model + localStorage storage for onboarding funnel"
```

---

## Task 2: quiz → ledger mapping

**Files:**
- Create: `src/components/onboarding/quizToLedger.ts`
- Test: `src/components/onboarding/quizToLedger.test.ts`

**Interfaces:**
- Consumes: `QuizState`, `QUIZ_CATEGORIES` from `./quizModel`.
- Produces: `quizToLedger(state: QuizState): { account: string; balanceCents: number }[]` — one entry per non-zero answer; liabilities negated (positive magnitude in, negative out); zero/absent categories omitted. Return type matches `ManualBalanceInput` from `~/server/workspaceSummary`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/onboarding/quizToLedger.test.ts
import { describe, expect, it } from "vitest";
import { quizToLedger } from "./quizToLedger";
import type { QuizState } from "./quizModel";

const state = (entries: QuizState["entries"]): QuizState => ({ version: 1, goal: "net-worth", entries });

describe("quizToLedger", () => {
  it("keeps assets positive and negates liabilities", () => {
    const out = quizToLedger(state([
      { category: "everyday", cents: 420000 },
      { category: "mortgage", cents: 30000000 },
    ]));
    expect(out).toContainEqual({ account: "Assets:Bank:Everyday", balanceCents: 420000 });
    expect(out).toContainEqual({ account: "Liabilities:Mortgage", balanceCents: -30000000 });
  });

  it("omits zero-value entries", () => {
    expect(quizToLedger(state([{ category: "savings", cents: 0 }]))).toEqual([]);
  });

  it("maps every category to its configured account path", () => {
    const out = quizToLedger(state([
      { category: "kiwisaver", cents: 100 },
      { category: "creditcard", cents: 100 },
    ]));
    expect(out).toContainEqual({ account: "Assets:Investments:KiwiSaver", balanceCents: 100 });
    expect(out).toContainEqual({ account: "Liabilities:CreditCard", balanceCents: -100 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/onboarding/quizToLedger.test.ts`
Expected: FAIL — cannot resolve `./quizToLedger`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/onboarding/quizToLedger.ts
import { QUIZ_CATEGORIES, type QuizState } from "./quizModel";

const META_BY_ID = new Map(QUIZ_CATEGORIES.map((c) => [c.id, c]));

export function quizToLedger(state: QuizState): { account: string; balanceCents: number }[] {
  const out: { account: string; balanceCents: number }[] = [];
  for (const entry of state.entries) {
    if (entry.cents <= 0) continue;
    const meta = META_BY_ID.get(entry.category);
    if (!meta) continue;
    const signed = meta.kind === "liability" ? -entry.cents : entry.cents;
    out.push({ account: meta.account, balanceCents: signed });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/onboarding/quizToLedger.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/quizToLedger.ts src/components/onboarding/quizToLedger.test.ts
git commit -m "feat: map quiz answers to signed manual ledger balances"
```

---

## Task 3: reveal-dashboard builder

**Files:**
- Create: `src/components/onboarding/buildRevealDashboard.ts`
- Test: `src/components/onboarding/buildRevealDashboard.test.ts`

**Interfaces:**
- Consumes: `QuizState`, `QUIZ_CATEGORIES`, `LiquidityTier` from `./quizModel`; `quizToLedger` from `./quizToLedger`; `combineBalances` from `~/server/workspaceSummary`; `LedgerDashboardData`, `BalanceRow` types from `~/components/dashboard/dashboardData`.
- Produces: `buildRevealDashboard(state: QuizState, generatedAt?: string): LedgerDashboardData` — a valid dashboard payload with `databaseExists: true`, real `totals.netWorthCents/assetsCents/liabilitiesCents`, `balances` carrying `currency:"NZD"` + a `liquidityTier`, `cashCents`/`availableLiquidityCents` summed from cash-tier assets, and every other field zero/empty.

Note: `~/server/workspaceSummary` and `~/components/dashboard/dashboardData` are import-only for their **types** plus the pure `combineBalances` function (no Supabase). This test therefore imports `~/`-aliased modules; vitest resolves `~` via `vitest.config.ts`. Confirm `combineBalances`'s module has no Supabase import (audit: it is pure). If a transitive import breaks node-env resolution, inline a local copy of the net-worth math instead and note it.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/onboarding/buildRevealDashboard.test.ts
import { describe, expect, it } from "vitest";
import { buildRevealDashboard } from "./buildRevealDashboard";
import type { QuizState } from "./quizModel";

const AT = "2026-07-13T00:00:00.000Z";
const state: QuizState = {
  version: 1,
  goal: "net-worth",
  entries: [
    { category: "everyday", cents: 500000 },   // +5,000 cash
    { category: "kiwisaver", cents: 4000000 },  // +40,000 semi_liquid
    { category: "mortgage", cents: 30000000 },  // -300,000 liability
  ],
};

describe("buildRevealDashboard", () => {
  it("computes net worth = assets - liabilities from the answers", () => {
    const d = buildRevealDashboard(state, AT);
    expect(d.totals.assetsCents).toBe(4500000);
    expect(d.totals.liabilitiesCents).toBe(30000000); // surfaced positive
    expect(d.totals.netWorthCents).toBe(-25500000);
  });

  it("marks the database as existing so widgets do not short-circuit", () => {
    expect(buildRevealDashboard(state, AT).databaseExists).toBe(true);
  });

  it("tags balances with NZD currency and a liquidity tier", () => {
    const d = buildRevealDashboard(state, AT);
    const everyday = d.balances.find((b) => b.account === "Assets:Bank:Everyday");
    expect(everyday?.currency).toBe("NZD");
    expect(everyday?.liquidityTier).toBe("cash");
    expect(everyday?.isManual).toBe(true);
  });

  it("sums cashCents from cash-tier assets only", () => {
    expect(buildRevealDashboard(state, AT).totals.cashCents).toBe(500000);
  });

  it("returns empty analytics collections and a null error", () => {
    const d = buildRevealDashboard(state, AT);
    expect(d.pnl).toEqual([]);
    expect(d.recentTransactions).toEqual([]);
    expect(d.error).toBeNull();
    expect(d.generatedAt).toBe(AT);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/onboarding/buildRevealDashboard.test.ts`
Expected: FAIL — cannot resolve `./buildRevealDashboard`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/onboarding/buildRevealDashboard.ts
// Builds a minimal-but-valid LedgerDashboardData from anonymous quiz answers so
// the reveal renders the user's real numbers with no account/server round-trip.
import { combineBalances } from "~/server/workspaceSummary";
import type { LedgerDashboardData, BalanceRow } from "~/components/dashboard/dashboardData";
import { QUIZ_CATEGORIES, type LiquidityTier } from "./quizModel";
import { quizToLedger } from "./quizToLedger";

const TIER_BY_ACCOUNT = new Map<string, LiquidityTier>(
  QUIZ_CATEGORIES.map((c) => [c.account, c.liquidityTier]),
);

export function buildRevealDashboard(
  state: QuizState,
  generatedAt: string = new Date().toISOString(),
): LedgerDashboardData {
  const manual = quizToLedger(state);
  const { balances, totals } = combineBalances([], manual);

  const balanceRows: BalanceRow[] = balances.map((b) => ({
    account: b.account,
    accountType: b.accountType,
    balanceCents: b.balanceCents,
    currency: "NZD",
    isManual: true,
    liquidityTier: TIER_BY_ACCOUNT.get(b.account) ?? "illiquid",
  }));

  const cashCents = balanceRows
    .filter((b) => b.accountType === "Assets" && b.liquidityTier === "cash")
    .reduce((sum, b) => sum + b.balanceCents, 0);

  return {
    databasePath: "quiz://reveal",
    databaseExists: true,
    generatedAt,
    manualBalances: balanceRows.map((b) => ({
      account: b.account,
      balanceCents: b.balanceCents,
      asOfDate: generatedAt.slice(0, 10),
      updatedAt: generatedAt,
    })),
    totals: {
      netWorthCents: totals.netWorthCents,
      assetsCents: totals.assetsCents,
      liabilitiesCents: totals.liabilitiesCents,
      assetLiabilityRatio: totals.assetLiabilityRatio,
      incomeCents: 0,
      expensesCents: 0,
      ebitdaCents: 0,
      ebitdaMargin: null,
      averageMonthlyIncomeCents: 0,
      monthlyOverheadCents: 0,
      runwayMonths: null,
      transactionCount: 0,
      rawTransactionCount: 0,
      cashCents,
      creditHeadroomCents: 0,
      creditLimitCents: 0,
      availableLiquidityCents: cashCents,
    },
    balances: balanceRows,
    creditFacilities: [],
    pnl: [],
    incomeBreakdown: [],
    expenseBreakdown: [],
    suspenseQueue: [],
    netWorthTrend: [],
    recentTransactions: [],
    recurringPayments: [],
    categoryMonthly: [],
    dailySpend: [],
    pipeline: { totalRaw: 0, classified: 0, suspense: 0, lastRunAt: null },
    sourceAccounts: [],
    knownAccounts: balanceRows.map((b) => b.account),
    routing: { journalCount: 0, customRuleCount: 0, nzfccFallbackCount: 0, suspenseCount: 0, suspenseCents: 0, classificationRate: 0 },
    syncState: [],
    error: null,
  };
}
```

> If `tsc` reports that `pipeline`/`routing`/any sub-object shape differs from
> `dashboardData.ts`, open that file and copy the exact interface — the zero-values
> above must match the real field names/types. This is a typecheck-driven fix, not a
> guess: adjust the object literal until `pnpm build`'s `tsc --noEmit` is clean.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/onboarding/buildRevealDashboard.test.ts`
Expected: PASS (5 tests). If a `~/`-aliased transitive import fails under node env, apply the fallback noted in Interfaces.

- [ ] **Step 5: Typecheck**

Run: `pnpm build`
Expected: no `tsc --noEmit` errors from the new file. Fix any shape mismatch against `dashboardData.ts` before committing.

- [ ] **Step 6: Commit**

```bash
git add src/components/onboarding/buildRevealDashboard.ts src/components/onboarding/buildRevealDashboard.test.ts
git commit -m "feat: build a valid dashboard payload from anonymous quiz answers"
```

---

## Task 4: The quiz UI + public `/start` route

**Files:**
- Create: `src/components/onboarding/QuizFlow.tsx`, `GoalScreen.tsx`, `BalanceScreen.tsx`, `QuizProgress.tsx`, `onboarding-quiz.css`
- Create: `src/routes/start.tsx`

**Interfaces:**
- Consumes: `QUIZ_GOALS`, `QUIZ_CATEGORIES`, `QuizState`, `QuizGoal`, `QuizCategory` from `./quizModel`; `loadQuizState`, `persistQuizState` from `./quizStorage`.
- Produces: `QuizFlow` (default export) — a client component owning quiz state; renders goal screen, then one `BalanceScreen` per category, persisting to localStorage on each change; on completion sets an internal `phase: "reveal"` and renders `RevealScreen` (Task 5). `<Route>` at `/start`, public (no auth in loader).

- [ ] **Step 1: Build the route (public) mounting the flow**

```tsx
// src/routes/start.tsx
import { createFileRoute } from "@tanstack/react-router";
import { QuizFlow } from "~/components/onboarding/QuizFlow";
import "~/components/onboarding/onboarding-quiz.css";

export const Route = createFileRoute("/start")({
  head: () => ({
    meta: [
      { title: "See your financial picture — YouInc" },
      { name: "description", content: "See your whole financial picture in about two minutes — no account needed." },
    ],
  }),
  component: QuizFlow,
});
```

- [ ] **Step 2: Build `QuizProgress` (goal-gradient bar)**

```tsx
// src/components/onboarding/QuizProgress.tsx
interface QuizProgressProps { current: number; total: number; }
export function QuizProgress({ current, total }: QuizProgressProps) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="quiz-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="quiz-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
```

- [ ] **Step 3: Build `GoalScreen`**

```tsx
// src/components/onboarding/GoalScreen.tsx
import { QUIZ_GOALS, type QuizGoal } from "./quizModel";
interface GoalScreenProps { value: QuizGoal | null; onSelect: (goal: QuizGoal) => void; }
export function GoalScreen({ value, onSelect }: GoalScreenProps) {
  return (
    <section className="quiz-screen" aria-labelledby="quiz-goal-heading">
      <h1 id="quiz-goal-heading" className="quiz-screen__headline">What are you trying to get a handle on?</h1>
      <ul className="quiz-goal__list">
        {QUIZ_GOALS.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              className={`quiz-goal__option${value === g.id ? " is-selected" : ""}`}
              aria-pressed={value === g.id}
              onClick={() => onSelect(g.id)}
            >
              {g.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Build `BalanceScreen` (slider + typed override + skip)**

```tsx
// src/components/onboarding/BalanceScreen.tsx
import { useState } from "react";
import type { QuizCategoryMeta } from "./quizModel";
import { formatMoney } from "~/components/widgets/format";

interface BalanceScreenProps {
  meta: QuizCategoryMeta;
  cents: number;                       // current value (0 if unanswered)
  onChange: (cents: number) => void;
  onNext: () => void;
  onSkip: () => void;
}
export function BalanceScreen({ meta, cents, onChange, onNext, onSkip }: BalanceScreenProps) {
  const [text, setText] = useState(cents ? String(Math.round(cents / 100)) : "");
  return (
    <section className="quiz-screen" aria-labelledby={`quiz-${meta.id}-heading`}>
      <h1 id={`quiz-${meta.id}-heading`} className="quiz-screen__headline">{meta.label}</h1>
      <p className="quiz-screen__hint">{meta.hint}</p>
      <output className="quiz-balance__value">{formatMoney(cents)}</output>
      <input
        type="range" min={0} max={meta.sliderMaxCents} step={meta.sliderStepCents} value={cents}
        aria-label={`${meta.label} amount`}
        onChange={(e) => { const v = Number(e.target.value); onChange(v); setText(String(Math.round(v / 100))); }}
      />
      <label className="quiz-balance__exact">
        Or type it exactly
        <input
          inputMode="numeric" value={text}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            setText(digits);
            onChange(digits ? Number(digits) * 100 : 0);
          }}
        />
      </label>
      <div className="quiz-screen__actions">
        <button type="button" className="mk-btn mk-btn--ghost" onClick={onSkip}>I don't have this</button>
        <button type="button" className="mk-btn mk-btn--primary" onClick={onNext}>Next</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Build `QuizFlow` (state machine + persistence)**

```tsx
// src/components/onboarding/QuizFlow.tsx
import { useEffect, useState } from "react";
import { QUIZ_CATEGORIES, type QuizCategory, type QuizGoal, type QuizState } from "./quizModel";
import { loadQuizState, persistQuizState } from "./quizStorage";
import { GoalScreen } from "./GoalScreen";
import { BalanceScreen } from "./BalanceScreen";
import { QuizProgress } from "./QuizProgress";
import { RevealScreen } from "./RevealScreen";

type Phase = "goal" | number | "reveal"; // number = index into QUIZ_CATEGORIES
const TOTAL = QUIZ_CATEGORIES.length + 1; // goal + categories

export function QuizFlow() {
  const [state, setState] = useState<QuizState>(() =>
    typeof window === "undefined" ? { version: 1, goal: null, entries: [] } : loadQuizState(),
  );
  const [phase, setPhase] = useState<Phase>("goal");
  useEffect(() => { persistQuizState(state); }, [state]);

  const centsFor = (id: QuizCategory) => state.entries.find((e) => e.category === id)?.cents ?? 0;
  const setGoal = (goal: QuizGoal) => { setState((s) => ({ ...s, goal })); setPhase(0); };
  const setCents = (id: QuizCategory, cents: number) =>
    setState((s) => {
      const rest = s.entries.filter((e) => e.category !== id);
      return { ...s, entries: cents > 0 ? [...rest, { category: id, cents }] : rest };
    });
  const advance = (i: number) => setPhase(i + 1 >= QUIZ_CATEGORIES.length ? "reveal" : i + 1);

  if (phase === "reveal") return <RevealScreen state={state} onRestart={() => setPhase("goal")} />;

  const stepIndex = phase === "goal" ? 0 : phase + 1;
  return (
    <main className="mk quiz-flow">
      <QuizProgress current={stepIndex} total={TOTAL} />
      {phase === "goal" ? (
        <GoalScreen value={state.goal} onSelect={setGoal} />
      ) : (
        <BalanceScreen
          meta={QUIZ_CATEGORIES[phase]}
          cents={centsFor(QUIZ_CATEGORIES[phase].id)}
          onChange={(c) => setCents(QUIZ_CATEGORIES[phase].id, c)}
          onNext={() => advance(phase)}
          onSkip={() => { setCents(QUIZ_CATEGORIES[phase].id, 0); advance(phase); }}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 6: Add styles**

Create `src/components/onboarding/onboarding-quiz.css` with classes used above (`.quiz-flow`, `.quiz-progress`, `.quiz-progress__fill`, `.quiz-screen`, `.quiz-screen__headline`, `.quiz-goal__list/option`, `.quiz-balance__value/exact`, `.quiz-screen__actions`). Animate only `transform`/`opacity`/`width` on the progress fill (per web perf rules). Match the marketing token palette (`marketing-tokens.css`) so `.mk-btn` styles apply. (This step ships with Task 5's reveal styles; a temporary `RevealScreen` stub is added in Step 7 so the build passes.)

- [ ] **Step 7: Add a temporary RevealScreen stub so this task builds**

```tsx
// src/components/onboarding/RevealScreen.tsx  (STUB — replaced in Task 5)
import type { QuizState } from "./quizModel";
export function RevealScreen({ state, onRestart }: { state: QuizState; onRestart: () => void }) {
  return <div data-testid="reveal-stub" onClick={onRestart}>Reveal coming in Task 5 ({state.entries.length} entries)</div>;
}
```

- [ ] **Step 8: Verify it builds and renders**

Run: `pnpm build`
Expected: clean `tsc --noEmit`.
Manual: `pnpm dev`, visit `http://localhost:3000/start`, confirm the goal screen renders, selecting a goal advances to the first balance screen, the slider updates the formatted value, and reloading the page preserves entries (localStorage). Reaching the end shows the reveal stub.

- [ ] **Step 9: Commit**

```bash
git add src/components/onboarding/QuizFlow.tsx src/components/onboarding/GoalScreen.tsx src/components/onboarding/BalanceScreen.tsx src/components/onboarding/QuizProgress.tsx src/components/onboarding/RevealScreen.tsx src/components/onboarding/onboarding-quiz.css src/routes/start.tsx
git commit -m "feat: anonymous quiz flow on public /start route"
```

---

## Task 5: The reveal screen

**Files:**
- Modify: `src/components/onboarding/RevealScreen.tsx` (replace stub)
- Modify: `src/components/onboarding/onboarding-quiz.css` (reveal styles)

**Interfaces:**
- Consumes: `QuizState` from `./quizModel`; `buildRevealDashboard` from `./buildRevealDashboard`; `assetMix` from `~/components/widgets/derive`; `formatMoney`, `shortMoney`, `leafAccount` from `~/components/widgets/format`; `Link` from `@tanstack/react-router`; `QUIZ_GOALS` for the goal callback copy.
- Produces: `RevealScreen({ state, onRestart })` — a bespoke, designed reveal (not the app grid): a net-worth headline (count-up), an assets-vs-liabilities split, an asset-mix breakdown, and a primary CTA `<Link to="/signup">Save your picture →</Link>` plus a "start over" secondary that calls `onRestart`. Copy references the chosen goal.

- [ ] **Step 1: Implement the reveal**

```tsx
// src/components/onboarding/RevealScreen.tsx
import { Link } from "@tanstack/react-router";
import { buildRevealDashboard } from "./buildRevealDashboard";
import { QUIZ_GOALS, type QuizState } from "./quizModel";
import { assetMix } from "~/components/widgets/derive";
import { formatMoney, leafAccount } from "~/components/widgets/format";

const GOAL_CALLBACK: Record<string, string> = {
  "net-worth": "Here's your true net worth.",
  debt: "Here's exactly what you owe — and what you own.",
  save: "Here's what you've got to build on.",
  "see-it-all": "Here's everything, in one place.",
};

export function RevealScreen({ state, onRestart }: { state: QuizState; onRestart: () => void }) {
  const dashboard = buildRevealDashboard(state);
  const { totals, balances } = dashboard;
  const mix = assetMix(balances);
  const goalLabel = state.goal ? GOAL_CALLBACK[state.goal] : "Here's your picture.";
  const liabilities = balances.filter((b) => b.accountType === "Liabilities");

  return (
    <main className="mk reveal">
      <p className="reveal__eyebrow">{goalLabel}</p>
      <h1 className="reveal__networth">{formatMoney(totals.netWorthCents)}</h1>
      <p className="reveal__label">Net worth</p>

      <div className="reveal__split">
        <div><span className="reveal__split-label">Assets</span><span>{formatMoney(totals.assetsCents)}</span></div>
        <div><span className="reveal__split-label">Liabilities</span><span>{formatMoney(totals.liabilitiesCents)}</span></div>
      </div>

      {mix.slices.length > 0 && (
        <section className="reveal__mix" aria-label="Asset mix">
          {mix.slices.map((s) => (
            <div key={s.tier} className="reveal__mix-row">
              <span>{s.tier}</span>
              <span className="reveal__mix-bar" style={{ transform: `scaleX(${s.fraction})` }} />
              <span>{formatMoney(s.cents)}</span>
            </div>
          ))}
        </section>
      )}

      {liabilities.length > 0 && (
        <ul className="reveal__debts">
          {liabilities.map((b) => (
            <li key={b.account}><span>{leafAccount(b.account)}</span><span>{formatMoney(-b.balanceCents)}</span></li>
          ))}
        </ul>
      )}

      <div className="reveal__actions">
        <Link className="mk-btn mk-btn--primary" to="/signup">Save your picture →</Link>
        <button type="button" className="mk-btn mk-btn--ghost" onClick={onRestart}>Start over</button>
      </div>
      <p className="reveal__reassure">Free. No card. Your numbers stay yours.</p>
    </main>
  );
}
```

> Verify `assetMix`'s returned slice fields are exactly `{ tier, cents, fraction }`
> (audit says so). If names differ, adjust. `formatMoney(totals.liabilitiesCents)`
> shows the positive magnitude (liabilities are surfaced positive in totals).

- [ ] **Step 2: Add reveal styles** to `onboarding-quiz.css` (`.reveal`, `.reveal__networth` large display type, `.reveal__split`, `.reveal__mix-bar` using `transform: scaleX` + `transform-origin:left`, `.reveal__actions`). Optionally animate the net-worth count-up with a small `requestAnimationFrame` helper or a CSS transition — compositor-friendly only.

- [ ] **Step 3: Verify**

Run: `pnpm build` → clean typecheck.
Manual: `pnpm dev`, complete the quiz at `/start` with a few balances, confirm the reveal shows a net-worth number equal to assets − liabilities, the asset-mix bars render, and "Save your picture" links to `/signup`.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/RevealScreen.tsx src/components/onboarding/onboarding-quiz.css
git commit -m "feat: personalized reveal screen with net worth, asset mix, save CTA"
```

---

## Task 6: Persist quiz balances after account creation

**Files:**
- Modify: `src/routes/onboarding.tsx`

**Interfaces:**
- Consumes: `loadQuizState`, `clearQuizState` from `~/components/onboarding/quizStorage`; `quizToLedger` from `~/components/onboarding/quizToLedger`; existing `createTenantFn`, `TenantSummary`, `AccountState` in `onboarding.tsx`; `upsertWorkspaceBalance` from `~/server/workspaceLedger` (via a new in-route server fn).
- Produces: a `persistQuizBalancesFn` (POST server fn) that upserts an array of `{account, balanceCents}`; onboarding, when quiz state exists, pre-fills the workspace name, and after `createTenant` replays the quiz balances then clears localStorage.

- [ ] **Step 1: Add the persist server fn (in `onboarding.tsx`, beside `createTenantFn`)**

```tsx
const persistQuizBalancesFn = createServerFn({ method: "POST" })
  .validator((entries: { account: string; balanceCents: number }[]) => entries)
  .handler(async ({ data: entries }): Promise<void> => {
    const { upsertWorkspaceBalance } = await import("~/server/workspaceLedger");
    for (const entry of entries) {
      await upsertWorkspaceBalance(entry);
    }
  });
```

- [ ] **Step 2: Pre-fill workspace name from quiz presence + read quiz state**

In `OnboardingPage`, after the existing `useState` hooks, add:

```tsx
const [quizEntries] = useState(() => (typeof window === "undefined" ? [] : quizToLedger(loadQuizState())));
const hasQuiz = quizEntries.length > 0;
// If the user arrived via the quiz and has no workspace name yet, keep the existing
// default (first name + "'s Inc."). If they skipped straight to onboarding, unchanged.
```

- [ ] **Step 3: Replay balances after tenant creation**

In the `createWorkspace` handler, after `const created = await createTenantFn({ data: name });` and before `setStep("connect")`:

```tsx
if (quizEntries.length > 0) {
  await persistQuizBalancesFn({ data: quizEntries });
  clearQuizState();
}
setTenant(created);
setStep("connect");
```

- [ ] **Step 4: Verify end to end (manual)**

Run: `pnpm build` → clean typecheck.
Manual: `pnpm dev`; complete `/start`, click "Save your picture", complete signup (dev has confirmations off → straight to `/onboarding`), name the workspace, and confirm `/workspace` shows the balances you entered in the quiz (net worth matches the reveal). Confirm `localStorage` `youinc-quiz-v1` is cleared after.

- [ ] **Step 5: Commit**

```bash
git add src/routes/onboarding.tsx
git commit -m "feat: persist quiz balances to the new tenant after signup"
```

---

## Task 7: Reframe the pricing page + re-point CTAs

**Files:**
- Modify: `src/components/marketing/config.ts`
- Modify: `src/components/marketing/config.test.ts`
- Modify: `src/components/marketing/PricingTable.tsx`
- Modify: `src/components/marketing/film/PricingLedger.tsx`
- Modify: `src/components/marketing/StartFreeCta.tsx`
- Modify: the landing hero CTA (discover via grep — see Step 5)

**Interfaces:**
- Consumes: existing `PRICING` in `config.ts`.
- Produces: pricing surfaces that drop Demo as a column/row, order to anchor Concierge high, and reframe copy around "free forever + live-sync trial"; primary CTAs point to `/start`.

- [ ] **Step 1: Update the pricing test to the intended copy (RED)**

In `config.test.ts`, change the "keeps the unauthenticated demo distinct" expectations to reflect Demo no longer being a pricing column (keep Demo as a concept if still referenced elsewhere; if you remove `PRICING.demo`, delete that test case). Add/adjust:

```ts
it("frames self-serve around live sync with a trial", () => {
  expect(PRICING.selfServe.price).toBe("NZD $15");
  expect(PRICING.selfServe.cadence).toBe("/mo");
});
it("keeps concierge as the high anchor", () => {
  expect(PRICING.concierge.price).toBe("From NZD $149");
});
it("prices the free tier at $0", () => {
  expect(PRICING.free.price).toBe("$0");
});
```

Run: `pnpm vitest run src/components/marketing/config.test.ts`
Expected: FAIL if you changed any pinned string; otherwise PASS (confirming the pins still hold). Reconcile intentionally.

- [ ] **Step 2: Reframe copy in `config.ts`**

Update `PRICING.free.cta` to `"Start — no card needed"`, `PRICING.selfServe.cta` to `"Add live sync"`, and add a trial note to `selfServe.features` (e.g. first item `"14-day free trial — no card"`). Keep the pinned price strings unchanged. Do **not** duplicate price literals elsewhere.

- [ ] **Step 3: Drop Demo from `PricingTable.tsx`**

Remove the Demo `<th>`/`<td>` column and the `demo` cells in the comparison rows; make the header order Concierge → Self-serve (featured) → Free is NOT required, but move Concierge to the first data column to anchor high. Replace the Demo "Open the demo" CTA cell by an inline link under the table caption: `See a live demo →` to `/demo`. Update `PRICING_COMPARISON` consumption accordingly (drop the `demo` field usage in the table; you may keep the field in the data or remove it — if removed, update `PricingComparisonRow`).

- [ ] **Step 4: Update `PricingLedger.tsx` (shared with landing film Act VI)**

Remove the `demo` row from `ROWS`; order `concierge` first (anchor), then `selfServe` (featured), then `free`. Point the `free` and `selfServe` CTAs `to: "/start"` instead of `/signup`. Verify BOTH `/pricing` and the landing film Act VI still render correctly.

- [ ] **Step 5: Re-point primary CTAs to `/start`**

- In `StartFreeCta.tsx`, change the `<Link to="/signup">` to `<Link to="/start">`.
- Find the landing hero CTA: `grep -rn 'to="/signup"\|StartFreeCta\|Get started\|Start free' src/components/marketing/film src/routes/index.tsx`. Re-point the primary hero CTA to `/start` with copy "See your whole financial picture". Leave any "already have an account / sign in" links pointing at `/signin`.

- [ ] **Step 6: Run tests + build**

Run: `pnpm vitest run src/components/marketing/config.test.ts`
Expected: PASS.
Run: `pnpm build`
Expected: clean typecheck.
Manual: check `/pricing` (no Demo column, Concierge anchors, CTAs → `/start`) and `/` (hero CTA → `/start`).

- [ ] **Step 7: Commit**

```bash
git add src/components/marketing/config.ts src/components/marketing/config.test.ts src/components/marketing/PricingTable.tsx src/components/marketing/film/PricingLedger.tsx src/components/marketing/StartFreeCta.tsx src/routes/index.tsx
git commit -m "feat: reframe pricing around free-forever + live-sync trial; CTAs to /start"
```

---

## Task 8: End-to-end coverage

**Files:**
- Create: `e2e/quiz-funnel.spec.ts`

**Interfaces:**
- Consumes: the running app (`pnpm dev` via Playwright `webServer`).
- Produces: a spec proving the anonymous funnel works and the pricing CTA routes to it.

- [ ] **Step 1: Write the e2e spec**

```ts
// e2e/quiz-funnel.spec.ts
import { test, expect } from "@playwright/test";

test("/start renders the goal question publicly (no auth)", async ({ page }) => {
  await page.goto("/start");
  await expect(page).toHaveURL(/\/start$/);
  await expect(page.getByRole("heading", { level: 1, name: /what are you trying to get a handle on/i })).toBeVisible();
});

test("quiz flows goal → balances → reveal with the user's own numbers", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: /know my true net worth/i }).click();
  // First balance screen: type an exact everyday amount, then advance through the rest.
  await page.getByLabel(/type it exactly/i).fill("5000");
  await page.getByRole("button", { name: /^next$/i }).click();
  // Skip remaining categories to reach the reveal quickly.
  for (let i = 0; i < 8; i++) {
    const skip = page.getByRole("button", { name: /i don't have this/i });
    if (await skip.isVisible().catch(() => false)) await skip.click();
  }
  await expect(page.getByText(/net worth/i)).toBeVisible();
  await expect(page.getByText("$5,000.00")).toBeVisible();
  await expect(page.getByRole("link", { name: /save your picture/i })).toHaveAttribute("href", /\/signup/);
});

test("pricing hero CTA routes into the quiz", async ({ page }) => {
  await page.goto("/pricing");
  const cta = page.getByRole("link", { name: /start|financial picture/i }).first();
  await expect(cta).toHaveAttribute("href", /\/start/);
});
```

- [ ] **Step 2: Run the e2e**

Run: `pnpm test:e2e e2e/quiz-funnel.spec.ts`
Expected: PASS (3 tests). If the exact-amount field label differs, align the selector with the `BalanceScreen` markup.

- [ ] **Step 3: Full test sweep + build**

Run: `pnpm test && pnpm build`
Expected: all unit tests PASS, clean typecheck.

- [ ] **Step 4: Commit**

```bash
git add e2e/quiz-funnel.spec.ts
git commit -m "test: e2e for anonymous quiz funnel and pricing CTA routing"
```

---

## Self-review notes (verified against the spec)

- **Spec A1 entry point** → Tasks 4 (route) + 7 (CTAs). No `PUBLIC_PATHS` change needed (corrected).
- **Spec A2 quiz** → Task 4 (goal-first, ~6 screens, sliders + typed override + skip, progress bar, localStorage).
- **Spec A3 mapping + reveal compute** → Tasks 1–3 (pure, unit-tested; reveal number == workspace number via shared `combineBalances`).
- **Spec A4 reveal** → Task 5 (own data only; goal callback; no unverifiable claims).
- **Spec A5 save → persist + onboarding reconcile** → Task 6.
- **Spec A6 pricing reframe + test coupling** → Task 7.
- **E2E** → Task 8.
- **Deferred (own later plans):** Phase B (trial: `trial_ends_at` migration + gating + day-12 reminder) and Phase C (Stripe billing) — not in this plan by design.
