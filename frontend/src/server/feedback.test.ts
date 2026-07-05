import { describe, expect, it } from "vitest";
import { validateFeedback } from "./feedbackValidation";

describe("validateFeedback", () => {
  it("parses a valid vote", () => {
    expect(validateFeedback({ vote: "up", variant: "A", source: "landing", path: "/" }))
      .toEqual({ vote: "up", variant: "A", source: "landing", path: "/" });
  });

  it("throws a catchable 400 ServerFnError on an invalid vote", () => {
    try {
      validateFeedback({ vote: "sideways", variant: "A", source: "landing", path: "/" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).name).toBe("ServerFnError");
      expect((err as Error & { status: number }).status).toBe(400);
    }
  });
});
