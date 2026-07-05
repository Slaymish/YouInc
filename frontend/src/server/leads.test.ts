import { describe, expect, it } from "vitest";
import { validateLead } from "./leadsValidation";

describe("validateLead", () => {
  it("parses and lower-cases a valid signup", () => {
    const result = validateLead({ email: "Jane@Example.com", source: "hero" });
    expect(result).toEqual({ lead: expect.objectContaining({ email: "jane@example.com", source: "hero" }) });
  });

  it("returns skip for a filled honeypot (no persistence)", () => {
    expect(validateLead({ email: "bot@b.com", company: "Acme Spam" })).toEqual({ skip: true });
  });

  it("throws a catchable 400 ServerFnError on invalid email", () => {
    try {
      validateLead({ email: "not-an-email" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).name).toBe("ServerFnError");
      expect((err as Error & { status: number }).status).toBe(400);
    }
  });

  it("throws 400 when the honeypot exceeds 200 chars", () => {
    try {
      validateLead({ email: "bot@b.com", company: "x".repeat(201) });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as Error & { status: number }).status).toBe(400);
    }
  });
});
