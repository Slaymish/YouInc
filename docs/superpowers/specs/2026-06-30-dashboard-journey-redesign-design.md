# Dashboard Journey Redesign

**Date:** 2026-06-30
**Status:** Approved (design)
**Area:** `frontend/src/components/dashboard`, `frontend/src/components/widgets`

## Problem

The default dashboard tab ("Overview") shows 12 widgets — a single-verdict Control
Brief, six small KPI tiles, and four charts. It reads as a dense data dump, not a
clear answer to any one question. The user's actual journey is a **weekly review**,
and the thing they most want to know on opening is **"does anything need my
attention, and what do I do about it?"**. None of the existing widgets aggregate the
attention signals the system already computes; the closest is the single-verdict
Control Brief and a raw Suspense Queue list.

## Goals

- Make the default tab answer "what needs my attention" in ~5 seconds.
- Reorganize tabs around journeys, not data domains.
- Keep the default lean and give it a clear top-to-bottom narrative.
- Keep every existing widget available; orphan nothing.

## Non-goals

- No changes to the Python ledger pipeline, schema, or posting logic.
- No new SQLite reads — the Action Center derives from data already on
  `LedgerDashboardData`.
- No redesign of individual existing widgets' internals.

## Tab structure (journey-based)

Four tabs; the first is the default.

| Tab | Journey | Replaces |
|-----|---------|----------|
| **This Week** *(default)* | Weekly triage: "Does anything need me, and what do I do?" | Overview |
| **Cash Flow** | "How did money move, and is anything off?" | Cashflow |
| **Wealth** | "Is net worth growing, and how long does it last?" | Wealth |
| **Books** | "Are my numbers trustworthy?" | Ledger Ops |

## "This Week" default tab

Eight widgets (down from 12), strict narrative order: **verdict → what to do →
headline numbers → this month → trajectory.**

1. `attention` — **Action Center** (new; full-width hero)
2. `control-brief` — decision verdict (ALLOCATE / PRESERVE / MONITOR / …)
3. KPI strip — **4** tiles only: `metric-net-worth`, `metric-runway`,
   `metric-burn`, `metric-margin`
   - `metric-assets` and `metric-liabilities` move to **Wealth**; they are not
     weekly-decision metrics.
4. `month-pulse` — how this month tracks vs usual
5. `net-worth-trend` — trajectory context

## New widget: `attention` (Action Center)

Full-width hero. Aggregates every attention signal into one prioritized,
severity-sorted list. Each row carries: a severity indicator, a count or value, a
one-line "what & why", and a target tab to jump to.

| Signal | Source field(s) | Example row |
|--------|-----------------|-------------|
| Unclassified items | `routing.suspenseCount` / `suspenseQueue` | "3 transactions to classify → Books" |
| Low runway | `totals.runwayMonths` (< threshold) | "Runway 2.8 mo — preserve liquidity → Wealth" |
| Stale sync | `pipeline.lastSeenAt` / `pipeline.latestTransactionDate` age | "Last sync 9 days ago — refresh → Books" |
| Spending anomalies | `spendingAnomalies()` over `categoryMonthly` | "Groceries +62% vs typical → Cash Flow" |
| Unmapped accounts | `sourceAccounts[].mappingStatus === "unmapped"` | "1 account unmapped → Books" |
| Recurring creep | `recurringPayments` (new / increased) | "New subscription detected → Cash Flow" |

**Empty state** (the success state of a weekly review): "✓ All clear — books are
decision-grade. Nothing needs you this week."

### Severity ordering

Rows sort by severity descending. Proposed tiers:

- **Blocked/critical:** no database, runway below critical threshold.
- **Action needed:** suspense items, unmapped accounts, stale sync.
- **Review:** spending anomalies, recurring creep.

Within a tier, order by magnitude (e.g. larger anomaly %, more suspense items first).

## Deep-dive tabs (ordered widget id lists)

**Cash Flow** (in → out → net narrative, then composition, then detail):
`cashflow-waterfall`, `operating-statement`, `expense-breakdown`,
`income-breakdown`, `recurring`, `spending-anomalies`, `spend-calendar`,
`rolling-burn`, `income-concentration`.

**Wealth** (trajectory first, then composition):
`net-worth-trend`, `net-worth-velocity`, `runway-projection`, `metric-net-worth`,
`metric-assets`, `metric-liabilities`, `liquidity`, `asset-mix`, `balance-sheet`,
`manual-accounts`.

**Books** (trust, then the work):
`ledger-confidence`, `suspense-queue`, `ingestion`, `source-systems`, `journal`.

## Technical design

### Derivation — `buildAttentionItems(dashboard): AttentionItem[]`

Pure function in `frontend/src/components/widgets/derive.ts`. No data fetching.
Reuses existing `spendingAnomalies`, `recurringPayments`, `totals`, `routing`,
`pipeline`, `sourceAccounts`. Returns a severity-sorted array.

```ts
type AttentionSeverity = "critical" | "action" | "review";
type TargetView = "this-week" | "cash-flow" | "wealth" | "books";

interface AttentionItem {
  id: string;            // stable key, e.g. "suspense", "runway"
  severity: AttentionSeverity;
  label: string;         // "3 transactions to classify"
  detail: string;        // one-line why / what to do
  targetView: TargetView;
}
```

Thresholds (stale-sync days, anomaly %, runway-critical months, runway-warn months)
are named constants at the top of the module — no magic numbers.

### Widget wiring

Per `frontend/CLAUDE.md`'s documented procedure:

- Add `"attention"` to the `WidgetId` union in `widgets.ts`.
- Add a `WidgetDefinition` to `WIDGET_REGISTRY` (category `overview`,
  `defaultW: 12, defaultH: 4`, sensible mins).
- Create `frontend/src/components/widgets/AttentionWidget.tsx`, taking
  `{ dashboard: LedgerDashboardData }`, rendering `buildAttentionItems(dashboard)`,
  using `NoData`/empty-state pattern for the all-clear case.
- Add a `case "attention"` to `renderWidgetContent` in `DashboardGrid.tsx`.

### Tabs

Rewrite `VIEW_BLUEPRINTS` in `views.ts` with the four new `{ id, name, ids }`
blueprints above. `packLayout` already shelf-packs + compacts ordered id lists into
valid layouts, so only ordered id lists are specified.

### Migration

Bump `STORAGE_KEY` in `useDashboardLayout.ts` from `youinc-dashboard-views-v1` to
`youinc-dashboard-views-v2`. The old persisted layout would otherwise shadow the new
defaults. Customizations are re-derivable; acceptable for a single-user local app.

### Targeting / navigation

The Action Center's `targetView` should select the corresponding tab. The view
blueprints get stable ids (`this-week`, `cash-flow`, `wealth`, `books`) so the
widget can call the existing `selectView(id)` path. Wiring the click-through uses the
layout hook's `selectView`; the exact plumbing (context vs prop) is an
implementation detail for the plan.

## Testing

- Unit tests for `buildAttentionItems`:
  - each signal fires when its condition is met and stays quiet otherwise
  - severity ordering and within-tier magnitude ordering
  - empty/all-clear state returns no items
- Unit test that each new `VIEW_BLUEPRINTS` entry produces a valid, non-overlapping
  `packLayout` containing exactly its ids.
- Typecheck via `pnpm build` (tsc `--noEmit`).

## Risks

- Threshold tuning (what counts as "stale", "anomaly") may need iteration; isolating
  them as named constants keeps that cheap.
- Recurring-creep detection ("new / increased") depends on what `detectRecurring`
  already exposes; if it lacks a "first seen" / delta signal, that single row may be
  deferred. All other signals are directly available.
