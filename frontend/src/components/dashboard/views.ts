import { compact, type WidgetPlacement } from "./grid";
import { WIDGET_MAP, type WidgetId } from "./widgets";

export interface DashboardView {
  id: string;
  name: string;
  layout: WidgetPlacement[];
}

const COLS = 12;

/**
 * Shelf-packs an ordered list of widgets across the 12-column grid using each
 * widget's default size, then compacts upward to fill gaps. Produces a tidy,
 * always-valid layout from a plain ordered id list.
 */
export function packLayout(ids: WidgetId[]): WidgetPlacement[] {
  const placements: WidgetPlacement[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  for (const id of ids) {
    const def = WIDGET_MAP.get(id);
    if (!def) continue;
    const w = Math.min(def.defaultW, COLS);
    const h = def.defaultH;
    if (x + w > COLS) {
      y += rowHeight;
      x = 0;
      rowHeight = 0;
    }
    placements.push({ id, x, y, w, h });
    x += w;
    rowHeight = Math.max(rowHeight, h);
  }

  return compact(placements);
}

interface ViewBlueprint {
  id: string;
  name: string;
  ids: WidgetId[];
}

// Curated default tabs, organized by journey. The first view is the default.
// Each view's id matches an AttentionTargetView so the Action Center can
// deep-link into it. Ordering is chosen so the shelf-packer lays out related
// widgets together. Every registered widget appears in at least one view.
const VIEW_BLUEPRINTS: ViewBlueprint[] = [
  {
    // Weekly triage: "does anything need me, and what do I do?"
    id: "this-week",
    name: "This Week",
    ids: [
      "attention",
      "control-brief",
      "metric-net-worth",
      "metric-runway",
      "metric-burn",
      "metric-margin",
      "month-pulse",
      "net-worth-trend",
    ],
  },
  {
    // "How did money move, and is anything off?"
    id: "cash-flow",
    name: "Cash Flow",
    ids: [
      "cashflow-waterfall",
      "operating-statement",
      "expense-breakdown",
      "income-breakdown",
      "recurring",
      "spending-anomalies",
      "spend-calendar",
      "rolling-burn",
      "income-concentration",
    ],
  },
  {
    // "Is net worth growing, and how long does it last?"
    id: "wealth",
    name: "Wealth",
    ids: [
      "net-worth-trend",
      "net-worth-velocity",
      "runway-projection",
      "metric-net-worth",
      "metric-assets",
      "metric-liabilities",
      "metric-available-liquidity",
      "liquidity",
      "credit-facility",
      "asset-mix",
      "balance-sheet",
    ],
  },
  {
    // "Are my numbers trustworthy?"
    id: "books",
    name: "Books",
    ids: ["ledger-confidence", "journal"],
  },
];

/**
 * Builds the curated default tabs. When `allowedWidgetIds` is given (e.g. the
 * public /demo route), each blueprint's widget list is filtered down to the
 * allowlist first, and any blueprint left with zero widgets is dropped
 * entirely rather than rendered as an empty tab.
 */
export function defaultViews(allowedWidgetIds?: WidgetId[]): DashboardView[] {
  const allowed = allowedWidgetIds ? new Set(allowedWidgetIds) : null;
  return VIEW_BLUEPRINTS.map((blueprint) => ({
    id: blueprint.id,
    name: blueprint.name,
    ids: allowed ? blueprint.ids.filter((id) => allowed.has(id)) : blueprint.ids,
  }))
    .filter((blueprint) => blueprint.ids.length > 0)
    .map((blueprint) => ({
      id: blueprint.id,
      name: blueprint.name,
      layout: packLayout(blueprint.ids),
    }));
}
