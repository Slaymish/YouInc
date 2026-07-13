import { describe, expect, it } from "vitest";
import { reflowLayout, type WidgetPlacement } from "./grid";

function overlaps(a: WidgetPlacement, b: WidgetPlacement): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

describe("reflowLayout", () => {
  it("repairs arbitrary persisted coordinates into a compact skyline", () => {
    const result = reflowLayout([
      { id: "hero", x: 9, y: 12, w: 8, h: 8 },
      { id: "action", x: 0, y: 30, w: 4, h: 4 },
      { id: "brief", x: 5, y: 50, w: 4, h: 4 },
      { id: "metric", x: 11, y: 80, w: 3, h: 2 },
    ]);

    expect(result).toEqual([
      { id: "hero", x: 0, y: 0, w: 8, h: 8 },
      { id: "action", x: 8, y: 0, w: 4, h: 4 },
      { id: "brief", x: 8, y: 4, w: 4, h: 4 },
      { id: "metric", x: 0, y: 8, w: 12, h: 2 },
    ]);
  });

  it("never overlaps widgets for mixed sizes", () => {
    const result = reflowLayout([
      { id: "a", x: 0, y: 0, w: 7, h: 5 },
      { id: "b", x: 0, y: 0, w: 5, h: 3 },
      { id: "c", x: 0, y: 0, w: 5, h: 2 },
      { id: "d", x: 0, y: 0, w: 6, h: 4 },
    ]);

    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        expect(overlaps(result[i], result[j])).toBe(false);
      }
    }
  });

  it("fills an unopposed sparse row across all twelve columns", () => {
    expect(
      reflowLayout([
        { id: "a", x: 8, y: 9, w: 3, h: 2 },
        { id: "b", x: 1, y: 20, w: 3, h: 2 },
      ]),
    ).toEqual([
      { id: "a", x: 0, y: 0, w: 6, h: 2 },
      { id: "b", x: 6, y: 0, w: 6, h: 2 },
    ]);
  });

  it("does not stretch a short sidebar beside a taller hero", () => {
    expect(
      reflowLayout([
        { id: "hero", x: 0, y: 0, w: 8, h: 8 },
        { id: "side-a", x: 0, y: 0, w: 4, h: 4 },
        { id: "side-b", x: 0, y: 0, w: 4, h: 4 },
      ]),
    ).toEqual([
      { id: "hero", x: 0, y: 0, w: 8, h: 8 },
      { id: "side-a", x: 8, y: 0, w: 4, h: 4 },
      { id: "side-b", x: 8, y: 4, w: 4, h: 4 },
    ]);
  });

  it("fills the ragged edge of a mixed-height row", () => {
    expect(
      reflowLayout([
        { id: "tall", x: 0, y: 0, w: 6, h: 3 },
        { id: "short", x: 0, y: 0, w: 3, h: 2 },
      ]),
    ).toEqual([
      { id: "tall", x: 0, y: 0, w: 12, h: 3 },
      { id: "short", x: 0, y: 3, w: 12, h: 2 },
    ]);
  });
});
