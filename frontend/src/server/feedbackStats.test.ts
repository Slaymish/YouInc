import { beforeEach, describe, expect, it, vi } from "vitest";

// getSupabaseServerClient pulls in @supabase/ssr + TanStack Start's
// request-scoped cookie helpers, neither of which are available/desired in a
// plain-node vitest run. Mock it the same way any RLS-scoped server fn test
// in this codebase should: stub the client down to the one method under
// test (`rpc`), following feedback.ts's own convention of a single
// getSupabaseServerClient() call per handler.
const rpcMock = vi.fn();

vi.mock("./supabaseServer", () => ({
  getSupabaseServerClient: () => ({ rpc: rpcMock }),
}));

import { getFeedbackVariantStats } from "./feedbackStats";

describe("getFeedbackVariantStats", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("aggregates rows and computes the statistically significant leader", async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      data: [
        {
          variant: "A",
          source: "landing",
          path: "/",
          up_count: 800,
          down_count: 200,
          total: 1000,
          up_rate: 0.8,
        },
        {
          variant: "B",
          source: "landing",
          path: "/",
          up_count: 500,
          down_count: 500,
          total: 1000,
          up_rate: 0.5,
        },
      ],
      error: null,
    });

    // Act
    const result = await getFeedbackVariantStats();

    // Assert
    expect(result.aggregates).toEqual([
      {
        variant: "A",
        source: "landing",
        path: "/",
        upCount: 800,
        downCount: 200,
        total: 1000,
        upRate: 0.8,
      },
      {
        variant: "B",
        source: "landing",
        path: "/",
        upCount: 500,
        downCount: 500,
        total: 1000,
        upRate: 0.5,
      },
    ]);
    expect(result.leader.leaderVariant).toBe("A");
    expect(result.leader.isSignificant).toBe(true);
  });

  it("coerces string-encoded bigint/numeric columns from Postgres", async () => {
    // Arrange: bigint/numeric columns sometimes arrive as strings over the wire.
    rpcMock.mockResolvedValue({
      data: [
        {
          variant: "A",
          source: "landing",
          path: "/",
          up_count: "12",
          down_count: "3",
          total: "15",
          up_rate: "0.8",
        },
      ],
      error: null,
    });

    // Act
    const result = await getFeedbackVariantStats();

    // Assert
    expect(result.aggregates).toEqual([
      {
        variant: "A",
        source: "landing",
        path: "/",
        upCount: 12,
        downCount: 3,
        total: 15,
        upRate: 0.8,
      },
    ]);
  });

  it("passes p_since through to the RPC call when provided", async () => {
    // Arrange
    rpcMock.mockResolvedValue({ data: [], error: null });

    // Act
    await getFeedbackVariantStats({ since: "2026-01-01T00:00:00.000Z" });

    // Assert
    expect(rpcMock).toHaveBeenCalledWith("feedback_variant_stats", {
      p_since: "2026-01-01T00:00:00.000Z",
    });
  });

  it("throws a clear, non-leaking error when the RPC fails for a non-auth reason", async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value violates constraint" },
    });

    // Act & Assert
    await expect(getFeedbackVariantStats()).rejects.toMatchObject({
      name: "ServerFnError",
      message: "Could not load feedback stats.",
      status: 500,
    });
  });

  it("throws a 403-style error when the RPC denies insufficient privilege", async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "insufficient_privilege" },
    });

    // Act & Assert
    await expect(getFeedbackVariantStats()).rejects.toMatchObject({
      name: "ServerFnError",
      message: "Not authorized to view feedback stats.",
      status: 403,
    });
  });

  it("returns empty aggregates and no leader for an empty result set, without throwing", async () => {
    // Arrange
    rpcMock.mockResolvedValue({ data: [], error: null });

    // Act
    const result = await getFeedbackVariantStats();

    // Assert
    expect(result.aggregates).toEqual([]);
    expect(result.leader).toEqual({
      leaderVariant: null,
      isSignificant: false,
      pValue: null,
    });
  });

  it("treats a null data response the same as an empty result set", async () => {
    // Arrange
    rpcMock.mockResolvedValue({ data: null, error: null });

    // Act
    const result = await getFeedbackVariantStats();

    // Assert
    expect(result.aggregates).toEqual([]);
    expect(result.leader.leaderVariant).toBeNull();
  });
});
