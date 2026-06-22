# YouInc Dashboard — New Widget Ideas

Generated 2026-06-23. Ideas for genuinely new analytical widgets, grounded in the
data already computed in `LedgerDashboardData` (`frontend/src/server/ledger.ts`).

## Context

The current dashboard is strong on **stocks and flows as they are** — it reports
what happened. It has little that is **forward-looking, anomaly-aware, or
pattern-detecting**. That gap is where the high-value additions are.

### What exists today

- **Stats tiles:** net worth, runway, burn, margin, assets, liabilities, cash position
- **Trend/analysis:** operating statement, rolling average, net-worth trend,
  runway projection, month pulse, asset mix, expense/income breakdown
- **Ledger health:** ledger confidence, suspense queue, source systems, ingestion,
  balance sheet
- **Data/actions:** journal, manual accounts

---

## Ideas (ranked by value-to-effort)

### 1. Recurring & Subscriptions detector ⭐

Mine the journal for payments that repeat on a monthly cadence (same-ish
description + amount). Surface **committed monthly spend** and **annualized
subscription cost** — the classic "you're paying $1,847/yr for things you forgot
about" view.

- **Why it's smart:** nothing currently detects commitment vs discretionary spend.
- **Data needed:** server-side query over full journal history (not just the
  80-row recent window).
- **Effort:** medium (new server query + detection logic).

### 2. Net-worth velocity & milestones ⭐

The mirror image of the Runway widget. Runway projects cash *down*; this projects
wealth *up* from the `netWorthTrend` slope: "growing $X/mo → you cross $100k around
March 2027."

- **Why it's smart:** turns the net-worth trend into a forward trajectory with
  concrete milestone dates.
- **Data needed:** none new — pure client-side derive over `netWorthTrend`.
- **Effort:** low.

### 3. Income concentration / client risk

For a *personal Inc*, single-client dependency is the real risk. From
`incomeBreakdown`: "Top source = 74% of income" with an HHI-style concentration
gauge.

- **Why it's smart:** one income source drying up is the personal-Inc equivalent
  of customer churn — currently invisible.
- **Data needed:** mostly client-side over `incomeBreakdown`.
- **Effort:** low.

### 4. Cashflow waterfall

A bridge chart for the latest month: income → each expense category → net.
Connects the income and expense breakdowns into one "where did the money go"
visual instead of two separate lists.

- **Why it's smart:** shows how income is consumed in a single read, linking two
  existing widgets.
- **Data needed:** client-side, uses existing breakdowns + `pnl`.
- **Effort:** low-medium (SVG waterfall layout).

### 5. Spending anomalies — "Unusual this month"

Per-category z-score against its own history; flag categories running well above
normal, plus the largest single outlier transactions.

- **Why it's smart:** turns passive reporting into an alert.
- **Data needed:** per-category **monthly** data exposed to the client (currently
  only top-level monthly totals are passed).
- **Effort:** medium (server change + stats logic).

### 6. Daily spend calendar heatmap

GitHub-style daily-net heatmap. `transaction_date` is daily, but every current
view aggregates to month — you can't *see* spending rhythm (weekends, pay-cycle
spikes).

- **Why it's smart:** reveals temporal patterns no monthly view can show.
- **Data needed:** new daily aggregation query.
- **Effort:** medium.

---

## Recommendation

**#1 (Recurring & Subscriptions)** and **#2 (Net-worth velocity)** are the highest
signal.

- **#2** is nearly free — client-side derive, matches the existing Runway widget
  pattern exactly.
- **#1** produces the genuine "I didn't know that" moments, which is the whole
  point of a personal ERP.
