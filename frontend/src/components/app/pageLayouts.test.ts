import { describe, expect, it } from "vitest";
import {
  ACCOUNTS_LAYOUT,
  NET_WORTH_LAYOUT,
  SPENDING_LAYOUT,
  type PagePlacement,
} from "./pageLayouts";
import { WIDGET_MAP } from "~/components/dashboard/widgets";
import { WORKSPACE_WIDGET_IDS } from "~/components/workspace/workspaceWidgetIds";

function hasOverlap(layout: readonly PagePlacement[]): boolean {
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

const PAGES = [
  { name: "Spending", layout: SPENDING_LAYOUT },
  { name: "Net worth", layout: NET_WORTH_LAYOUT },
  { name: "Accounts", layout: ACCOUNTS_LAYOUT },
] as const;

describe("fixed page layouts", () => {
  for (const page of PAGES) {
    it(`${page.name} places only widgets the registry knows`, () => {
      for (const placement of page.layout) {
        expect(WIDGET_MAP.has(placement.id), placement.id).toBe(true);
      }
    });

    it(`${page.name} places only widgets the workspace loader populates`, () => {
      for (const placement of page.layout) {
        expect(WORKSPACE_WIDGET_IDS, placement.id).toContain(placement.id);
      }
    });

    it(`${page.name} never overlaps or repeats a card`, () => {
      expect(hasOverlap(page.layout)).toBe(false);
      const ids = page.layout.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it(`${page.name} stays inside the twelve columns`, () => {
      for (const placement of page.layout) {
        expect(placement.x).toBeGreaterThanOrEqual(0);
        expect(placement.x + placement.w).toBeLessThanOrEqual(12);
      }
    });
  }
});
