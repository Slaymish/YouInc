import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_DASHBOARD_STORAGE_KEY,
  filterStateToAllowed,
  loadDashboardState,
  persistDashboardState,
  type DashboardState,
} from "./dashboardStorage";
import type { WidgetId } from "./widgets";

/** Minimal in-memory localStorage polyfill — vitest's node environment has none. */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe("dashboardStorage", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = createMemoryStorage();
  });

  describe("loadDashboardState", () => {
    it("falls back to the allowlisted default views when nothing is persisted", () => {
      const allowed: WidgetId[] = ["metric-net-worth", "net-worth-trend"];
      const state = loadDashboardState("demo-key", allowed);
      expect(state.views.length).toBeGreaterThan(0);
      for (const view of state.views) {
        for (const placement of view.layout) {
          expect(allowed).toContain(placement.id);
        }
      }
    });

    it("filters disallowed widget ids out of a persisted layout", () => {
      localStorage.setItem(
        "demo-key",
        JSON.stringify({
          views: [
            {
              id: "v1",
              name: "V1",
              layout: [
                { id: "ingestion", x: 0, y: 0, w: 5, h: 4 },
                { id: "metric-net-worth", x: 5, y: 0, w: 2, h: 2 },
              ],
            },
          ],
          activeId: "v1",
        }),
      );
      const state = loadDashboardState("demo-key", ["metric-net-worth"] as WidgetId[]);
      expect(state.views[0].layout.map((p) => p.id)).toEqual(["metric-net-worth"]);
    });

    it("keeps every placement when no allowlist is given", () => {
      localStorage.setItem(
        DEFAULT_DASHBOARD_STORAGE_KEY,
        JSON.stringify({
          views: [
            {
              id: "v1",
              name: "V1",
              layout: [{ id: "ingestion", x: 0, y: 0, w: 5, h: 4 }],
            },
          ],
          activeId: "v1",
        }),
      );
      const state = loadDashboardState(DEFAULT_DASHBOARD_STORAGE_KEY);
      expect(state.views[0].layout.map((p) => p.id)).toEqual(["ingestion"]);
    });

    it("reads from the given key only, not the default key", () => {
      localStorage.setItem(
        DEFAULT_DASHBOARD_STORAGE_KEY,
        JSON.stringify({
          views: [{ id: "real", name: "Real", layout: [] }],
          activeId: "real",
        }),
      );
      const state = loadDashboardState("demo-key");
      // demo-key has nothing persisted, so this must fall back to defaults,
      // never reading the real dashboard's saved view under the default key.
      expect(state.views.some((v) => v.id === "real")).toBe(false);
    });

    it("falls back to defaults on malformed JSON instead of throwing", () => {
      localStorage.setItem("demo-key", "{not json");
      expect(() => loadDashboardState("demo-key")).not.toThrow();
    });
  });

  describe("persistDashboardState", () => {
    it("writes under the given storage key without touching the default key", () => {
      const state: DashboardState = {
        views: [{ id: "v1", name: "V1", layout: [] }],
        activeId: "v1",
      };
      persistDashboardState("youinc.demo.layout.v1", state);
      expect(localStorage.getItem("youinc.demo.layout.v1")).not.toBeNull();
      expect(localStorage.getItem(DEFAULT_DASHBOARD_STORAGE_KEY)).toBeNull();
    });
  });

  describe("filterStateToAllowed", () => {
    it("returns the same state when no allowlist is given", () => {
      const state: DashboardState = {
        views: [{ id: "v1", name: "V1", layout: [{ id: "ingestion", x: 0, y: 0, w: 5, h: 4 }] }],
        activeId: "v1",
      };
      expect(filterStateToAllowed(state)).toBe(state);
    });

    it("drops placements outside the allowlist without mutating the input", () => {
      const state: DashboardState = {
        views: [
          {
            id: "v1",
            name: "V1",
            layout: [
              { id: "ingestion", x: 0, y: 0, w: 5, h: 4 },
              { id: "metric-net-worth", x: 5, y: 0, w: 2, h: 2 },
            ],
          },
        ],
        activeId: "v1",
      };
      const original = JSON.parse(JSON.stringify(state));
      const filtered = filterStateToAllowed(state, ["metric-net-worth"] as WidgetId[]);
      expect(filtered.views[0].layout.map((p) => p.id)).toEqual(["metric-net-worth"]);
      expect(state).toEqual(original); // input untouched
    });
  });
});
