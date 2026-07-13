import { describe, expect, it } from "vitest";
import {
  selectTenantsNeedingReminder,
  trialReminderMessage,
  type ReminderTenant,
} from "./trialReminders";

const NOW = new Date("2026-07-13T00:00:00.000Z");

const t = (over: Partial<ReminderTenant>): ReminderTenant => ({
  id: "t1",
  name: "Acme",
  trialEndsAt: null,
  trialRemindedAt: null,
  ...over,
});

describe("selectTenantsNeedingReminder", () => {
  it("keeps only active, un-reminded tenants inside the lead window", () => {
    const due = t({ id: "due", trialEndsAt: "2026-07-14T00:00:00Z" }); // 1 day left
    const early = t({ id: "early", trialEndsAt: "2026-07-20T00:00:00Z" }); // 7 days
    const reminded = t({
      id: "reminded",
      trialEndsAt: "2026-07-14T00:00:00Z",
      trialRemindedAt: "2026-07-13T00:00:00Z",
    });
    const expired = t({ id: "expired", trialEndsAt: "2026-07-12T00:00:00Z" });
    const noTrial = t({ id: "none" });

    const result = selectTenantsNeedingReminder([due, early, reminded, expired, noTrial], NOW);
    expect(result.map((r) => r.id)).toEqual(["due"]);
  });
});

describe("trialReminderMessage", () => {
  it("names the workspace, day count, price, and cancel-anytime", () => {
    const msg = trialReminderMessage("owner@example.com", "Acme", 2);
    expect(msg.to).toBe("owner@example.com");
    expect(msg.subject).toContain("2 days");
    expect(msg.text).toContain("Acme");
    expect(msg.text).toContain("$15/mo");
    expect(msg.text.toLowerCase()).toContain("cancel anytime");
  });

  it("uses the singular 'day' at 1 day left", () => {
    expect(trialReminderMessage("o@e.com", "Acme", 1).subject).toContain("1 day");
    expect(trialReminderMessage("o@e.com", "Acme", 1).subject).not.toContain("1 days");
  });
});
