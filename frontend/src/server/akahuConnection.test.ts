import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

// akahuConnection.ts (and the tenantIngestion.ts it imports) both pull
// getSupabaseServerClient/getServerUser from "./supabaseServer", which in turn
// drags in @supabase/ssr + TanStack Start's request-cookie helpers — neither
// available nor wanted in a plain-node vitest run. Mock the module the same
// way feedbackStats.test.ts does: a minimal fake client exposing exactly the
// methods these functions call (`from`, `rpc`), with getServerUser stubbed
// separately so each test can flip signed-in/signed-out state.
const getServerUserMock = vi.fn();
const rpcMock = vi.fn();

/** The one row `requireTenant()` reads; null means "no tenant yet". */
let tenantRow: { id: string; tier: string } | null = null;
/** The one row the akahu_connections status lookup reads. */
let akahuConnectionRow: { status: string; connected_at: string | null; last_synced_at: string | null } | null =
  null;

function fromMock(table: string) {
  if (table === "tenants") {
    return {
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: tenantRow ? [tenantRow] : [], error: null }),
        }),
      }),
    };
  }
  if (table === "akahu_connections") {
    return {
      select: () => ({
        eq: () => ({
          limit: () =>
            Promise.resolve({ data: akahuConnectionRow ? [akahuConnectionRow] : [], error: null }),
        }),
      }),
    };
  }
  throw new Error(`Unexpected table in test: ${table}`);
}

vi.mock("./supabaseServer", () => ({
  getServerUser: () => getServerUserMock(),
  getSupabaseServerClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

import { connectAkahu, getAkahuConnectionStatus } from "./akahuConnection";

describe("Akahu tier gating", () => {
  beforeEach(() => {
    getServerUserMock.mockReset().mockResolvedValue({ id: "user-1" });
    rpcMock.mockReset().mockResolvedValue({ data: null, error: null });
    tenantRow = null;
    akahuConnectionRow = null;
  });

  describe("connectAkahu", () => {
    it("rejects a free-tier tenant with a clear, tagged error and never calls connect_akahu", async () => {
      // Arrange
      tenantRow = { id: "tenant-free", tier: "free" };

      // Act & Assert
      await expect(connectAkahu("user_token_abc")).rejects.toMatchObject({
        name: "ServerFnError",
        status: 403,
      });
      await expect(connectAkahu("user_token_abc")).rejects.toThrow(/TIER_RESTRICTED/);
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it.each(["self-serve", "concierge"] as const)(
      "allows a %s-tier tenant to connect and calls connect_akahu with their token",
      async (tier) => {
        // Arrange
        tenantRow = { id: "tenant-1", tier };

        // Act
        await connectAkahu("  user_token_abc  ");

        // Assert
        expect(rpcMock).toHaveBeenCalledWith("connect_akahu", {
          target_tenant: "tenant-1",
          user_token: "user_token_abc",
        });
      },
    );

    it("rejects when the caller is not signed in, before any tier check", async () => {
      // Arrange
      getServerUserMock.mockResolvedValue(null);
      tenantRow = { id: "tenant-1", tier: "self-serve" };

      // Act & Assert
      await expect(connectAkahu("user_token_abc")).rejects.toMatchObject({
        name: "ServerFnError",
        status: 401,
      });
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("still validates a blank token for a plan that is allowed to connect", async () => {
      // Arrange
      tenantRow = { id: "tenant-1", tier: "self-serve" };

      // Act & Assert
      await expect(connectAkahu("   ")).rejects.toMatchObject({
        name: "ServerFnError",
        status: 400,
      });
      expect(rpcMock).not.toHaveBeenCalled();
    });
  });

  describe("getAkahuConnectionStatus", () => {
    it("reports tier 'free' and canConnectLive: false for a free-tier tenant", async () => {
      // Arrange
      tenantRow = { id: "tenant-free", tier: "free" };

      // Act
      const status = await getAkahuConnectionStatus();

      // Assert
      expect(status.tier).toBe("free");
      expect(status.canConnectLive).toBe(false);
    });

    it.each(["self-serve", "concierge"] as const)(
      "reports canConnectLive: true for a %s-tier tenant",
      async (tier) => {
        // Arrange
        tenantRow = { id: "tenant-1", tier };

        // Act
        const status = await getAkahuConnectionStatus();

        // Assert
        expect(status.tier).toBe(tier);
        expect(status.canConnectLive).toBe(true);
      },
    );

    it("still reports the underlying connection state alongside the tier signal", async () => {
      // Arrange
      tenantRow = { id: "tenant-1", tier: "self-serve" };
      akahuConnectionRow = {
        status: "active",
        connected_at: "2026-01-01T00:00:00.000Z",
        last_synced_at: "2026-01-02T00:00:00.000Z",
      };

      // Act
      const status = await getAkahuConnectionStatus();

      // Assert
      expect(status.connected).toBe(true);
      expect(status.canConnectLive).toBe(true);
    });
  });
});
