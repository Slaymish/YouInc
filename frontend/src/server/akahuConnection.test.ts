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
let tenantRow: { id: string } | null = null;
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

// YouInc is self-hosted: whoever runs the instance brings their own Akahu
// credentials, so there is no tier, trial, or entitlement check on this path.
// The only gates left are authentication and input validation.
describe("Akahu connection", () => {
  beforeEach(() => {
    getServerUserMock.mockReset().mockResolvedValue({ id: "user-1" });
    rpcMock.mockReset().mockResolvedValue({ data: null, error: null });
    tenantRow = null;
    akahuConnectionRow = null;
  });

  describe("connectAkahu", () => {
    it("stores the token for any signed-in tenant", async () => {
      tenantRow = { id: "tenant-1" };

      await connectAkahu("akahu-user-token");

      expect(rpcMock).toHaveBeenCalledWith("connect_akahu", {
        target_tenant: "tenant-1",
        user_token: "akahu-user-token",
      });
    });

    it("rejects when the caller is not signed in, before touching the tenant", async () => {
      getServerUserMock.mockResolvedValue(null);
      tenantRow = { id: "tenant-1" };

      await expect(connectAkahu("akahu-user-token")).rejects.toThrow();
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("rejects a blank token without calling connect_akahu", async () => {
      tenantRow = { id: "tenant-1" };

      await expect(connectAkahu("   ")).rejects.toThrow();
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("fails when the signed-in user has no workspace yet", async () => {
      tenantRow = null;

      await expect(connectAkahu("akahu-user-token")).rejects.toThrow();
      expect(rpcMock).not.toHaveBeenCalled();
    });
  });

  describe("getAkahuConnectionStatus", () => {
    it("reports a disconnected tenant", async () => {
      tenantRow = { id: "tenant-1" };
      akahuConnectionRow = null;

      const status = await getAkahuConnectionStatus();

      expect(status.connected).toBe(false);
      expect(status.status).toBeNull();
      expect(status.lastSyncedAt).toBeNull();
    });

    it("reports the underlying connection state when active", async () => {
      tenantRow = { id: "tenant-1" };
      akahuConnectionRow = {
        status: "active",
        connected_at: "2026-07-01T00:00:00.000Z",
        last_synced_at: "2026-07-08T00:00:00.000Z",
      };

      const status = await getAkahuConnectionStatus();

      expect(status.connected).toBe(true);
      expect(status.status).toBe("active");
      expect(status.connectedAt).toBe("2026-07-01T00:00:00.000Z");
      expect(status.lastSyncedAt).toBe("2026-07-08T00:00:00.000Z");
    });

    it("exposes no tier, trial, or entitlement fields", async () => {
      tenantRow = { id: "tenant-1" };

      const status = await getAkahuConnectionStatus();

      expect(status).not.toHaveProperty("tier");
      expect(status).not.toHaveProperty("canConnectLive");
      expect(status).not.toHaveProperty("trialEndsAt");
      expect(status).not.toHaveProperty("trialDaysLeft");
    });
  });
});
