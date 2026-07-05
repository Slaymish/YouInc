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

  it("prices the signed-up free tier at $0", () => {
    expect(PRICING.free.price).toBe("$0");
  });

  it("names the product", () => {
    expect(PRODUCT.name).toBe("YouInc");
  });

  it("keeps the unauthenticated demo distinct from the signed-up free tier", () => {
    // Demo = no account, sample data. Free = a real account, manual data.
    // They must not collapse into the same tier name or CTA.
    expect(PRICING.demo.name).not.toBe(PRICING.free.name);
    expect(PRICING.free.name).toBe("Free");
    expect(PRICING.demo.name).toBe("Demo");
  });

  it("gates live Akahu sync to self-serve and above, not the free tier", () => {
    expect(PRICING.free.features).not.toContain("Live bank sync via Akahu");
    expect(PRICING.selfServe.features).toContain("Live bank sync via Akahu");
  });
});
