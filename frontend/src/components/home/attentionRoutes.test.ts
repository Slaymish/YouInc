import { describe, expect, it } from "vitest";
import { attentionLink } from "./attentionRoutes";

describe("attentionLink", () => {
  it("sends the unsorted-transactions row where sorting happens", () => {
    // Act + Assert
    expect(attentionLink({ id: "suspense" })).toEqual({
      to: "/app/activity",
      label: "Sort them",
    });
  });

  it("sends a stale bank feed to the accounts page", () => {
    // Act + Assert
    expect(attentionLink({ id: "stale-sync" }).to).toBe("/app/accounts");
  });

  it("keeps the demo's rows inside the demo", () => {
    // Act
    const link = attentionLink({ id: "suspense" }, "/demo");

    // Assert
    expect(link.to).toBe("/demo/activity");
  });

  it("never points the demo at the Workshop, which only a real instance has", () => {
    // Act
    const link = attentionLink({ id: "unmapped" }, "/demo");

    // Assert
    expect(link.to).toBe("/demo/activity");
  });

  it("falls back rather than rendering a dead row for an unknown signal", () => {
    // Act
    const link = attentionLink({ id: "something-new" });

    // Assert
    expect(link.to).toBe("/app/activity");
    expect(link.label).toBe("Take a look");
  });
});
