import { describe, expect, it } from "vitest";
import { PRODUCT, USE_PATHS, SOURCE_URL, SELF_HOST_URL } from "./config";

describe("product copy", () => {
  it("names the product", () => {
    expect(PRODUCT.name).toBe("YouInc");
  });

  it("points self-host links at the canonical repository", () => {
    expect(SOURCE_URL).toBe("https://github.com/Slaymish/YouInc");
    expect(SELF_HOST_URL.startsWith(SOURCE_URL)).toBe(true);
  });
});

describe("no commercial surface", () => {
  // YouInc is not sold. These assertions exist so that reintroducing a price,
  // a tier, or a booking link fails loudly rather than quietly shipping.
  const copy = JSON.stringify({ PRODUCT, USE_PATHS });

  it("mentions no currency amounts anywhere in marketing copy", () => {
    expect(copy).not.toMatch(/NZD|\$\d|USD/);
  });

  it("mentions no billing, trial, or subscription language", () => {
    expect(copy).not.toMatch(/\b(pricing|per month|\/mo|subscribe|trial|billing|invoice|card)\b/i);
  });

  it("offers exactly two paths, neither of which is an account", () => {
    expect(Object.keys(USE_PATHS)).toEqual(["demo", "selfHost"]);
    expect(USE_PATHS.demo.name).toBe("Demo");
    expect(USE_PATHS.selfHost.name).toBe("Self-host");
  });

  it("keeps live bank sync on the self-hosted path, not a hosted tier", () => {
    expect(USE_PATHS.selfHost.features.join(" ")).toMatch(/Akahu/);
    expect(USE_PATHS.demo.features.join(" ")).not.toMatch(/Akahu/);
  });
});
