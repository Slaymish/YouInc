import { describe, expect, it } from "vitest";
import {
  canConnectLive,
  isTrialActive,
  needsReminder,
  trialDaysLeft,
} from "./trial";

const NOW = new Date("2026-07-13T00:00:00.000Z");
const in7 = "2026-07-20T00:00:00.000Z";
const in2 = "2026-07-15T00:00:00.000Z";
const in1 = "2026-07-14T00:00:00.000Z";
const past = "2026-07-12T00:00:00.000Z";

describe("isTrialActive", () => {
  it("is true for a future end, false for null or past", () => {
    expect(isTrialActive(in7, NOW)).toBe(true);
    expect(isTrialActive(past, NOW)).toBe(false);
    expect(isTrialActive(null, NOW)).toBe(false);
  });
});

describe("canConnectLive", () => {
  it("always allows paid tiers", () => {
    expect(canConnectLive({ tier: "self-serve", trialEndsAt: null }, NOW)).toBe(true);
    expect(canConnectLive({ tier: "concierge", trialEndsAt: null }, NOW)).toBe(true);
  });
  it("allows free only while a trial is active", () => {
    expect(canConnectLive({ tier: "free", trialEndsAt: null }, NOW)).toBe(false);
    expect(canConnectLive({ tier: "free", trialEndsAt: in7 }, NOW)).toBe(true);
    expect(canConnectLive({ tier: "free", trialEndsAt: past }, NOW)).toBe(false);
  });
});

describe("trialDaysLeft", () => {
  it("returns whole days remaining, 0 past, null when no trial", () => {
    expect(trialDaysLeft(in7, NOW)).toBe(7);
    expect(trialDaysLeft(in2, NOW)).toBe(2);
    expect(trialDaysLeft(past, NOW)).toBe(0);
    expect(trialDaysLeft(null, NOW)).toBeNull();
  });
});

describe("needsReminder", () => {
  it("is true inside the lead window when not yet reminded", () => {
    expect(needsReminder({ trialEndsAt: in2, trialRemindedAt: null }, NOW)).toBe(true);
    expect(needsReminder({ trialEndsAt: in1, trialRemindedAt: null }, NOW)).toBe(true);
  });
  it("is false outside the lead window", () => {
    expect(needsReminder({ trialEndsAt: in7, trialRemindedAt: null }, NOW)).toBe(false);
  });
  it("is false when already reminded, expired, or no trial", () => {
    expect(needsReminder({ trialEndsAt: in1, trialRemindedAt: "2026-07-13T00:00:00Z" }, NOW)).toBe(false);
    expect(needsReminder({ trialEndsAt: past, trialRemindedAt: null }, NOW)).toBe(false);
    expect(needsReminder({ trialEndsAt: null, trialRemindedAt: null }, NOW)).toBe(false);
  });
});
