// Server-only Akahu connection + live-sync orchestration for self-service
// tenants. Ties together:
//   * the Vault-backed token RPCs (connect_akahu / get_akahu_user_token /
//     disconnect_akahu — migration 20260704120006),
//   * the TS AkahuClient (akahuClient.ts),
//   * the tenant ingestion write path (tenantIngestion.ts).
//
// The Akahu APP token is a server-wide secret (AKAHU_APP_TOKEN env, never sent
// to the browser). The per-user USER token is stored encrypted in Vault and only
// ever read server-side here for the duration of a sync — it is never returned
// to the client.
import { getSupabaseServerClient, getServerUser } from "./supabaseServer";
import { AkahuClient, AkahuApiError } from "./akahuClient";
import { ingestTenantPayloads, type IngestResult } from "./tenantIngestion";

function appToken(): string | null {
  return process.env.AKAHU_APP_TOKEN?.trim() || null;
}
function akahuBaseUrl(): string {
  return process.env.AKAHU_BASE_URL?.trim() || "https://api.akahu.io/v1";
}

async function requireTenantId(): Promise<string> {
  const user = await getServerUser();
  if (!user) throw new Response("You must be signed in.", { status: 401 });
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Response(error.message, { status: 400 });
  const row = data?.[0] as { id: string } | undefined;
  if (!row) throw new Response("No workspace found. Finish onboarding first.", { status: 409 });
  return row.id;
}

export interface AkahuConnectionStatus {
  connected: boolean;
  status: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  /** Whether the server has an app token configured (else live sync is unavailable). */
  appConfigured: boolean;
}

export async function getAkahuConnectionStatus(): Promise<AkahuConnectionStatus> {
  const tenantId = await requireTenantId();
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("akahu_connections")
    .select("status, connected_at, last_synced_at")
    .eq("tenant_id", tenantId)
    .limit(1);
  if (error) throw new Response(error.message, { status: 400 });
  const row = data?.[0] as
    | { status: string; connected_at: string | null; last_synced_at: string | null }
    | undefined;
  return {
    connected: row?.status === "active",
    status: row?.status ?? null,
    connectedAt: row?.connected_at ?? null,
    lastSyncedAt: row?.last_synced_at ?? null,
    appConfigured: appToken() !== null,
  };
}

/** Store the caller's Akahu user token (Vault) and mark the connection active. */
export async function connectAkahu(userToken: string): Promise<AkahuConnectionStatus> {
  const tenantId = await requireTenantId();
  const clean = userToken.trim();
  if (!clean) throw new Response("Enter your Akahu user token.", { status: 400 });

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("connect_akahu", {
    target_tenant: tenantId,
    user_token: clean,
  });
  if (error) throw new Response(error.message || "Could not save your Akahu connection.", { status: 400 });
  return getAkahuConnectionStatus();
}

/** Remove the caller's Akahu token from Vault and revoke the connection. */
export async function disconnectAkahu(): Promise<AkahuConnectionStatus> {
  const tenantId = await requireTenantId();
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("disconnect_akahu", { target_tenant: tenantId });
  if (error) throw new Response(error.message || "Could not disconnect.", { status: 400 });
  return getAkahuConnectionStatus();
}

async function userTokenFor(tenantId: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_akahu_user_token", { target_tenant: tenantId });
  if (error) throw new Response(error.message, { status: 400 });
  const token = typeof data === "string" ? data : null;
  if (!token) throw new Response("Akahu is not connected. Connect your account first.", { status: 409 });
  return token;
}

function buildClient(userToken: string): AkahuClient {
  const app = appToken();
  if (!app) {
    throw new Response(
      "Live Akahu sync is not configured on this server (missing AKAHU_APP_TOKEN).",
      { status: 503 },
    );
  }
  return new AkahuClient({ baseUrl: akahuBaseUrl(), appToken: app, userToken });
}

export interface AkahuAccountSummary {
  id: string;
  name: string;
  status: string | null;
}

/** List the accounts the connected Akahu user has authorized. */
export async function listConnectedAccounts(): Promise<AkahuAccountSummary[]> {
  const tenantId = await requireTenantId();
  const token = await userTokenFor(tenantId);
  const client = buildClient(token);
  let raw: Record<string, unknown>[];
  try {
    raw = await client.listAccounts();
  } catch (err) {
    if (err instanceof AkahuApiError) throw new Response(err.message, { status: 502 });
    throw err;
  }
  return raw
    .map((a) => {
      const id = String(a._id ?? a.id ?? "");
      if (!id) return null;
      const name =
        (a.name as string | undefined) ??
        ((a.formatted_account as string | undefined) || (a.connection as { name?: string } | undefined)?.name) ??
        id;
      return { id, name, status: (a.status as string | undefined) ?? null };
    })
    .filter((a): a is AkahuAccountSummary => a !== null);
}

export interface AkahuSyncResult extends IngestResult {
  accountId: string;
  fetched: number;
}

/**
 * Pull transactions for one Akahu account since `startDate` (default: last 90
 * days) and ingest them into the tenant's ledger. Idempotent via the ingestion
 * dedup. Updates last_synced_at on success.
 */
export async function syncAkahuAccount(
  accountId: string,
  startDate?: string,
): Promise<AkahuSyncResult> {
  const tenantId = await requireTenantId();
  const cleanAccount = accountId.trim();
  if (!cleanAccount) throw new Response("Choose an account to sync.", { status: 400 });

  const token = await userTokenFor(tenantId);
  const client = buildClient(token);

  const start =
    startDate ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const payloads: Record<string, unknown>[] = [];
  try {
    for await (const txn of client.iterTransactions(cleanAccount, start)) {
      payloads.push(txn);
    }
  } catch (err) {
    if (err instanceof AkahuApiError) throw new Response(err.message, { status: 502 });
    throw err;
  }

  const result = await ingestTenantPayloads(payloads);

  const supabase = getSupabaseServerClient();
  await supabase
    .from("akahu_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);

  return { ...result, accountId: cleanAccount, fetched: payloads.length };
}
