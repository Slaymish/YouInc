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

/**
 * The pinboard starts empty, by decision: seeding it with four ready-made
 * boards is work you'd have to undo before it's yours, and the point of the
 * pinboard is collecting what you care about. The analysis those tabs used to
 * do now lives on fixed pages (components/app/pageLayouts.ts).
 */
export const PINBOARD_VIEW_NAME = "Pinboard";

export function defaultViews(_allowedWidgetIds?: WidgetId[]): DashboardView[] {
  return [{ id: "pinboard", name: PINBOARD_VIEW_NAME, layout: [] }];
}
