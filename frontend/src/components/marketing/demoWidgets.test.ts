import { describe, expect, it } from "vitest";
import { DEMO_WIDGET_IDS, SHOWCASE_WIDGET_IDS } from "./demoWidgets";
import { WIDGET_MAP } from "../dashboard/widgets";

const MUTATING = new Set(["ingestion", "manual-accounts", "source-systems"]);

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

  it("keep the showcase small", () => {
    expect(SHOWCASE_WIDGET_IDS.length).toBeLessThanOrEqual(8);
  });
});
