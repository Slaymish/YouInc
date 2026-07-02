import { describe, expect, it } from "vitest";
import { resolveBookingUrl, PRICING, PRODUCT } from "./config";

describe("resolveBookingUrl", () => {
  it("returns the env override when present", () => {
    expect(resolveBookingUrl({ VITE_YOUINC_BOOKING_URL: "https://cal.com/me/x" })).toBe(
      "https://cal.com/me/x",
    );
  });

  it("falls back to the default placeholder when unset", () => {
    expect(resolveBookingUrl({})).toBe("https://cal.com/youinc/intro");
  });
});

describe("pricing + product copy", () => {
  it("prices self-serve concretely and concierge as 'from'", () => {
    expect(PRICING.selfServe.price).toBe("NZD $15");
    expect(PRICING.concierge.price).toBe("From NZD $149");
  });

  it("names the product", () => {
    expect(PRODUCT.name).toBe("YouInc");
  });
});
