import { describe, expect, test } from "vitest";
import {
  EMPTY_TOASTS,
  MAX_TOASTS,
  nextExpiryDelay,
  toastQueueReducer,
  type ToastItem,
} from "./toastQueue";

function item(id: number, expiresAt: number, onUndo?: () => void): ToastItem {
  return { id, message: `toast ${id}`, expiresAt, onUndo };
}

describe("toastQueueReducer", () => {
  test("appends a pushed toast to the end of the stack", () => {
    const state = toastQueueReducer(EMPTY_TOASTS, { type: "push", toast: item(1, 100) });
    const next = toastQueueReducer(state, { type: "push", toast: item(2, 200) });

    expect(next.map((t) => t.id)).toEqual([1, 2]);
  });

  test("evicts the oldest toast once the stack exceeds the cap", () => {
    const overflowing = Array.from({ length: MAX_TOASTS + 2 }, (_, i) => item(i + 1, 100));
    const next = overflowing.reduce<readonly ToastItem[]>(
      (state, toast) => toastQueueReducer(state, { type: "push", toast }),
      EMPTY_TOASTS,
    );

    expect(next).toHaveLength(MAX_TOASTS);
    expect(next[0].id).toBe(3);
  });

  test("does not mutate the previous state when pushing", () => {
    const state = [item(1, 100)];
    toastQueueReducer(state, { type: "push", toast: item(2, 200) });

    expect(state.map((t) => t.id)).toEqual([1]);
  });

  test("dismiss removes only the named toast", () => {
    const state = [item(1, 100), item(2, 200)];
    const next = toastQueueReducer(state, { type: "dismiss", id: 1 });

    expect(next.map((t) => t.id)).toEqual([2]);
  });

  test("dismiss of an unknown id returns the same reference", () => {
    const state = [item(1, 100)];

    expect(toastQueueReducer(state, { type: "dismiss", id: 99 })).toBe(state);
  });

  test("expire drops toasts whose deadline has passed and keeps the rest", () => {
    const state = [item(1, 100), item(2, 500)];
    const next = toastQueueReducer(state, { type: "expire", now: 100 });

    expect(next.map((t) => t.id)).toEqual([2]);
  });

  test("expire returns the same reference when nothing is due", () => {
    const state = [item(1, 100)];

    expect(toastQueueReducer(state, { type: "expire", now: 50 })).toBe(state);
  });

  test("extend grants every queued toast a fresh window", () => {
    const state = [item(1, 100), item(2, 500)];
    const next = toastQueueReducer(state, { type: "extend", from: 1000, durationMs: 8000 });

    expect(next.map((t) => t.expiresAt)).toEqual([9000, 9000]);
  });

  test("extend preserves the undo callback identity", () => {
    const onUndo = () => {};
    const next = toastQueueReducer([item(1, 100, onUndo)], {
      type: "extend",
      from: 0,
      durationMs: 10,
    });

    expect(next[0].onUndo).toBe(onUndo);
  });

  test("extend on an empty queue returns the same reference", () => {
    expect(
      toastQueueReducer(EMPTY_TOASTS, { type: "extend", from: 0, durationMs: 10 }),
    ).toBe(EMPTY_TOASTS);
  });
});

describe("nextExpiryDelay", () => {
  test("returns null when nothing is queued", () => {
    expect(nextExpiryDelay(EMPTY_TOASTS, 0)).toBeNull();
  });

  test("returns the delay to the soonest deadline", () => {
    expect(nextExpiryDelay([item(1, 900), item(2, 400)], 100)).toBe(300);
  });

  test("clamps an overdue deadline to zero rather than going negative", () => {
    expect(nextExpiryDelay([item(1, 100)], 5000)).toBe(0);
  });
});
