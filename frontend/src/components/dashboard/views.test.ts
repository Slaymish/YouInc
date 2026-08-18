import { describe, expect, it } from "vitest";
import { defaultViews, packLayout } from "./views";
import type { WidgetPlacement } from "./grid";
import type { WidgetId } from "./widgets";

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

describe("defaultViews (the pinboard)", () => {
  it("starts empty, so nothing has to be undone before it's yours", () => {
    // Act
    const views = defaultViews();

    // Assert
    expect(views).toEqual([{ id: "pinboard", name: "Pinboard", layout: [] }]);
  });

  it("ignores an allowlist, because there is nothing placed to filter", () => {
    // Act + Assert — /demo passes DEMO_WIDGET_IDS; an empty board is still empty.
    expect(defaultViews(["metric-net-worth"] as WidgetId[])).toEqual(defaultViews());
  });
});

describe("packLayout", () => {
  it("shelf-packs widgets without overlapping them", () => {
    // Arrange
    const ids: WidgetId[] = [
      "metric-net-worth",
      "metric-runway",
      "net-worth-trend",
      "asset-mix",
    ];

    // Act
    const layout = packLayout(ids);

    // Assert
    expect(layout).toHaveLength(ids.length);
    expect(hasOverlap(layout)).toBe(false);
    expect(new Set(layout.map((p) => p.id)).size).toBe(ids.length);
  });

  it("keeps every placement inside the twelve columns", () => {
    // Act
    const layout = packLayout(["balance-sheet", "net-worth-trend"] as WidgetId[]);

    // Assert
    for (const placement of layout) {
      expect(placement.x).toBeGreaterThanOrEqual(0);
      expect(placement.x + placement.w).toBeLessThanOrEqual(12);
    }
  });

  it("skips an id the registry doesn't know", () => {
    // Act
    const layout = packLayout(["metric-net-worth", "not-a-widget"] as WidgetId[]);

    // Assert
    expect(layout.map((p) => p.id)).toEqual(["metric-net-worth"]);
  });
});
