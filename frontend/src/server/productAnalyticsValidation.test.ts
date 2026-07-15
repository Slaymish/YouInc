import { describe, expect, it } from "vitest";
import { validateAnalyticsEvent } from "./productAnalyticsValidation";

describe("validateAnalyticsEvent", () => {
  it("accepts an allowlisted event with its declared coarse properties", () => {
    expect(
      validateAnalyticsEvent({
        eventName: "marketing_cta_clicked",
        anonymousId: "2eb0ed46-eef6-43ce-946f-168cb9b15b4d",
        sessionId: "9a497bc7-1b00-49ba-ac65-26f7e02d6062",
        properties: { placement: "pricing-table" },
      }),
    ).toEqual({
      eventName: "marketing_cta_clicked",
      anonymousId: "2eb0ed46-eef6-43ce-946f-168cb9b15b4d",
      sessionId: "9a497bc7-1b00-49ba-ac65-26f7e02d6062",
      properties: { placement: "pricing-table" },
    });
  });

  it("rejects unknown events and properties instead of silently collecting them", () => {
    expect(() =>
      validateAnalyticsEvent({ eventName: "button_clicked", properties: {} }),
    ).toThrow(/event/i);
    expect(() =>
      validateAnalyticsEvent({
        eventName: "dashboard_viewed",
        properties: { balance: 123_45 },
      }),
    ).toThrow(/propert/i);
  });

  it("rejects values that could contain personal or financial data", () => {
    expect(() =>
      validateAnalyticsEvent({
        eventName: "marketing_cta_clicked",
        properties: { placement: "https://example.com/start?email=person@example.com" },
      }),
    ).toThrow(/value/i);
    expect(() =>
      validateAnalyticsEvent({
        eventName: "marketing_cta_clicked",
        properties: { placement: "123456" },
      }),
    ).toThrow(/value/i);
  });
});
