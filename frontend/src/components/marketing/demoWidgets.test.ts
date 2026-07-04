import { describe, expect, it } from "vitest";
import { DEMO_WIDGET_IDS, SHOWCASE_WIDGET_IDS } from "./demoWidgets";
import { WIDGET_REGISTRY, WIDGET_MAP } from "../dashboard/widgets";

const MUTATING = new Set([
  "ingestion",
  "manual-accounts",
  "source-systems",
  "suspense-queue",
]);

describe("curated widget id lists", () => {
  it("only reference real widgets", () => {
    for (const id of [...DEMO_WIDGET_IDS, ...SHOWCASE_WIDGET_IDS]) {
      expect(WIDGET_MAP.has(id)).toBe(true);
    }
  });

  it("never expose mutating/data-entry widgets in the public demo", () => {
    for (const id of DEMO_WIDGET_IDS) {
      expect(MUTATING.has(id)).toBe(false);
    }
  });

  it("offers every non-mutating registered widget in the public demo", () => {
    // DEMO_WIDGET_IDS is the DashboardGrid `allowedWidgetIds` allowlist for
    // /demo — it should track the full registry minus the mutating set, not
    // drift into a hand-picked subset that leaves the demo feeling thin.
    const nonMutating = WIDGET_REGISTRY.map((w) => w.id).filter((id) => !MUTATING.has(id));
    expect(new Set(DEMO_WIDGET_IDS)).toEqual(new Set(nonMutating));
  });

  it("keep the showcase small", () => {
    expect(SHOWCASE_WIDGET_IDS.length).toBeLessThanOrEqual(8);
  });
});
