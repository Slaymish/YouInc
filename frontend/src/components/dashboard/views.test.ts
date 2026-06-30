import { describe, expect, it } from "vitest";
import { defaultViews } from "./views";
import type { WidgetPlacement } from "./grid";

/** True if any two placements in the layout overlap on the grid. */
function hasOverlap(layout: WidgetPlacement[]): boolean {
  for (let i = 0; i < layout.length; i += 1) {
    for (let j = i + 1; j < layout.length; j += 1) {
      const a = layout[i];
      const b = layout[j];
      const disjoint =
        a.x + a.w <= b.x ||
        b.x + b.w <= a.x ||
        a.y + a.h <= b.y ||
        b.y + b.h <= a.y;
      if (!disjoint) return true;
    }
  }
  return false;
}

describe("defaultViews (journey tabs)", () => {
  const views = defaultViews();

  it("exposes the four journey tabs in order, with This Week first", () => {
    expect(views.map((v) => v.id)).toEqual([
      "this-week",
      "cash-flow",
      "wealth",
      "books",
    ]);
    expect(views[0].name).toBe("This Week");
  });

  it("leads the default tab with the Action Center", () => {
    const thisWeek = views.find((v) => v.id === "this-week");
    expect(thisWeek?.layout.some((p) => p.id === "attention")).toBe(true);
  });

  it("produces a valid, non-overlapping layout for every tab", () => {
    for (const view of views) {
      expect(view.layout.length).toBeGreaterThan(0);
      expect(hasOverlap(view.layout)).toBe(false);
      const ids = view.layout.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length); // no duplicate widgets
    }
  });
});
