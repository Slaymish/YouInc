import { describe, expect, it } from "vitest";
import { defaultViews } from "./views";
import type { WidgetPlacement } from "./grid";
import type { WidgetId } from "./widgets";
import { DEMO_WIDGET_IDS } from "../marketing/demoWidgets";

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

describe("defaultViews (allowlist filtering, e.g. the public /demo route)", () => {
  it("keeps every tab and widget when no allowlist is given", () => {
    expect(defaultViews(undefined)).toEqual(defaultViews());
  });

  it("only places allowed widgets, and drops widgets that aren't allowed", () => {
    const allowed: WidgetId[] = ["metric-net-worth", "net-worth-trend", "recurring"];
    const views = defaultViews(allowed);
    for (const view of views) {
      for (const placement of view.layout) {
        expect(allowed).toContain(placement.id);
      }
    }
  });

  it("drops a tab entirely when none of its widgets are allowed", () => {
    // The "books" blueprint is ledger-confidence / suspense-queue / ingestion /
    // source-systems / journal — excluding all of them should remove the tab
    // rather than render an empty "Books" view.
    const allowed: WidgetId[] = ["metric-net-worth", "net-worth-trend"];
    const views = defaultViews(allowed);
    expect(views.some((v) => v.id === "books")).toBe(false);
    expect(views.length).toBeGreaterThan(0);
  });

  it("never overlaps and never duplicates widgets within a filtered tab", () => {
    const views = defaultViews(DEMO_WIDGET_IDS);
    expect(views.length).toBeGreaterThan(0);
    for (const view of views) {
      expect(view.layout.length).toBeGreaterThan(0);
      expect(hasOverlap(view.layout)).toBe(false);
      const ids = view.layout.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(DEMO_WIDGET_IDS).toContain(id);
      }
    }
  });

  it("filters every surviving tab down to a single widget when only one is allowed", () => {
    const views = defaultViews(["metric-net-worth"] as WidgetId[]);
    // metric-net-worth appears in both the "this-week" and "wealth"
    // blueprints, so both tabs survive, each containing just that widget.
    expect(views.length).toBe(2);
    for (const view of views) {
      expect(view.layout).toEqual([{ id: "metric-net-worth", x: 0, y: 0, w: 12, h: 2 }]);
    }
  });
});
