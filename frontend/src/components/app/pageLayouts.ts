// Fixed layouts for the analysis pages. Lifted from the hand-composed tab
// layouts these pages replace (the "cash-flow" and "wealth" saved views), so
// the composition is the one that was already tuned rather than a fresh guess.
//
// Twelve columns and 80px rows, matching the pinboard grid — the same CSS
// renders both, minus drag handles.
import type { WidgetPlacement } from "~/components/dashboard/grid";
import type { WidgetId } from "~/components/dashboard/widgets";

/**
 * A placement whose id is a real widget, checked at compile time — a typo in a
 * hand-written layout would otherwise render as a silently missing card.
 */
export interface PagePlacement extends WidgetPlacement {
  id: WidgetId;
}

/** Where is it going? */
export const SPENDING_LAYOUT: readonly PagePlacement[] = [
  { id: "metric-burn", x: 0, y: 0, w: 4, h: 2 },
  { id: "metric-margin", x: 4, y: 0, w: 4, h: 2 },
  { id: "metric-available-liquidity", x: 8, y: 0, w: 4, h: 2 },
  { id: "cashflow-waterfall", x: 0, y: 2, w: 7, h: 6 },
  { id: "operating-statement", x: 7, y: 2, w: 5, h: 6 },
  { id: "expense-breakdown", x: 0, y: 8, w: 4, h: 5 },
  { id: "income-breakdown", x: 4, y: 8, w: 4, h: 5 },
  { id: "recurring", x: 8, y: 8, w: 4, h: 5 },
  { id: "spending-anomalies", x: 0, y: 13, w: 5, h: 4 },
  { id: "spend-calendar", x: 5, y: 13, w: 7, h: 4 },
  { id: "rolling-burn", x: 0, y: 17, w: 7, h: 5 },
  { id: "income-concentration", x: 7, y: 17, w: 5, h: 5 },
];

/** Am I getting richer? */
export const NET_WORTH_LAYOUT: readonly PagePlacement[] = [
  { id: "net-worth-trend", x: 0, y: 0, w: 8, h: 8 },
  { id: "metric-net-worth", x: 8, y: 0, w: 4, h: 3 },
  { id: "net-worth-velocity", x: 8, y: 3, w: 4, h: 5 },
  { id: "metric-assets", x: 0, y: 8, w: 4, h: 2 },
  { id: "metric-liabilities", x: 4, y: 8, w: 4, h: 2 },
  { id: "metric-runway", x: 8, y: 8, w: 4, h: 2 },
  { id: "runway-projection", x: 0, y: 10, w: 7, h: 5 },
  { id: "asset-mix", x: 7, y: 10, w: 5, h: 5 },
  { id: "balance-sheet", x: 0, y: 15, w: 12, h: 8 },
];

/** What's connected, what's it worth — the cards that belong beside the list. */
export const ACCOUNTS_LAYOUT: readonly PagePlacement[] = [
  { id: "liquidity", x: 0, y: 0, w: 7, h: 5 },
  { id: "credit-facility", x: 7, y: 0, w: 5, h: 5 },
];
