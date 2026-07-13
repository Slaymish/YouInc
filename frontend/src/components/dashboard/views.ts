import { reflowLayout, type WidgetPlacement } from "./grid";
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

  return reflowLayout(placements);
}

interface ViewBlueprint {
  id: string;
  name: string;
  ids: WidgetId[];
}

type CuratedPlacement = Omit<WidgetPlacement, "id">;

// The default dashboard is composed like an editorial spread rather than
// shelf-packed as a wall of equal cards. These are recommendations only:
// users can still move and resize every widget in Customize mode.
const CURATED_LAYOUTS: Record<string, Partial<Record<WidgetId, CuratedPlacement>>> = {
  "this-week": {
    "net-worth-trend": { x: 0, y: 0, w: 8, h: 8 },
    attention: { x: 8, y: 0, w: 4, h: 4 },
    "control-brief": { x: 8, y: 4, w: 4, h: 4 },
    "metric-net-worth": { x: 0, y: 8, w: 3, h: 2 },
    "metric-runway": { x: 3, y: 8, w: 3, h: 2 },
    "metric-burn": { x: 6, y: 8, w: 3, h: 2 },
    "metric-margin": { x: 9, y: 8, w: 3, h: 2 },
    "month-pulse": { x: 0, y: 10, w: 12, h: 3 },
  },
  "cash-flow": {
    "cashflow-waterfall": { x: 0, y: 0, w: 7, h: 6 },
    "operating-statement": { x: 7, y: 0, w: 5, h: 6 },
    "expense-breakdown": { x: 0, y: 6, w: 4, h: 5 },
    "income-breakdown": { x: 4, y: 6, w: 4, h: 5 },
    recurring: { x: 8, y: 6, w: 4, h: 5 },
    "spending-anomalies": { x: 0, y: 11, w: 5, h: 4 },
    "spend-calendar": { x: 5, y: 11, w: 7, h: 4 },
    "rolling-burn": { x: 0, y: 15, w: 7, h: 5 },
    "income-concentration": { x: 7, y: 15, w: 5, h: 5 },
  },
  wealth: {
    "net-worth-trend": { x: 0, y: 0, w: 8, h: 8 },
    "metric-net-worth": { x: 8, y: 0, w: 4, h: 3 },
    "net-worth-velocity": { x: 8, y: 3, w: 4, h: 5 },
    "runway-projection": { x: 0, y: 8, w: 7, h: 5 },
    liquidity: { x: 7, y: 8, w: 5, h: 5 },
    "metric-assets": { x: 0, y: 13, w: 4, h: 2 },
    "metric-liabilities": { x: 4, y: 13, w: 4, h: 2 },
    "metric-available-liquidity": { x: 8, y: 13, w: 4, h: 2 },
    "credit-facility": { x: 0, y: 15, w: 6, h: 3 },
    "asset-mix": { x: 6, y: 15, w: 6, h: 3 },
    "balance-sheet": { x: 0, y: 18, w: 12, h: 8 },
  },
  books: {
    "ledger-confidence": { x: 0, y: 0, w: 5, h: 5 },
    "suspense-queue": { x: 5, y: 0, w: 7, h: 5 },
    journal: { x: 0, y: 5, w: 12, h: 8 },
  },
};

function curatedLayout(blueprint: ViewBlueprint, ids: WidgetId[]): WidgetPlacement[] {
  if (ids.length === 1) return packLayout(ids);
  const recommendations = CURATED_LAYOUTS[blueprint.id];
  if (!recommendations) return packLayout(ids);

  const placements = ids.flatMap((id) => {
    const placement = recommendations[id];
    return placement ? [{ id, ...placement }] : [];
  });
  return placements.length === ids.length
    ? reflowLayout(placements.sort((a, b) => a.y - b.y || a.x - b.x))
    : packLayout(ids);
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
    ids: ["ledger-confidence", "suspense-queue", "journal"],
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
      layout: curatedLayout(blueprint, blueprint.ids),
    }));
}
