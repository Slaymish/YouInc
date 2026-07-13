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
import { throwServerError } from "./serverError";
import { appToken, akahuBaseUrl, oauthConfigured } from "./akahuOAuth";
import type { TenantTier } from "./accounts";
import { canConnectLive, trialDaysLeft } from "./trial";

// The OAuth authorize-URL / code-exchange logic lives in the pure,
// path-alias-free akahuOAuth.ts (see its header comment for why) and is
// re-exported here so the API routes have one server-module surface for the
// whole Akahu connect feature, per the existing convention in this file.
export {
  oauthConfigured,
  buildAkahuAuthorizeUrl,
  exchangeAkahuOAuthCode,
  resolveAkahuCallback,
  AkahuOAuthError,
} from "./akahuOAuth";
export type { AkahuCallbackOutcome, AkahuCallbackQuery } from "./akahuOAuth";

interface TenantContext {
  id: string;
  tier: TenantTier;
  trialEndsAt: string | null;
}

// Single tenant lookup shared by every Akahu operation below — same table +
// column shape accounts.ts's getAccountState() reads (tenants.id, tenants.tier,
// tenants.trial_ends_at), so tier/trial gating here never drifts from the tenant
// summary the rest of the app already trusts. Most callers only need the id
// (requireTenantId()); the connect + sync paths also need the tier + trial to
// decide whether live sync is allowed right now.
async function requireTenant(): Promise<TenantContext> {
  const user = await getServerUser();
  if (!user) throwServerError("You must be signed in.", 401);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, tier, trial_ends_at")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throwServerError(error.message, 400);
  const row = data?.[0] as
    | { id: string; tier: TenantTier; trial_ends_at: string | null }
    | undefined;
  if (!row) throwServerError("No workspace found. Finish onboarding first.", 409);
  return { id: row.id, tier: row.tier, trialEndsAt: row.trial_ends_at ?? null };
}

async function requireTenantId(): Promise<string> {
  return (await requireTenant()).id;
}

const TIER_RESTRICTED_MESSAGE =
  "TIER_RESTRICTED: Live bank sync isn't active on the Free plan. Start your " +
  "14-day free trial to connect your bank, or upgrade to Self-serve.";

const TRIAL_ENDED_MESSAGE =
  "TRIAL_ENDED: Your free trial of live sync has ended. Add a card to keep " +
  "syncing, or keep using manual accounts — your data stays put.";

export interface AkahuConnectionStatus {
  connected: boolean;
  status: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  /** Whether the server has an app token configured (else live sync is unavailable). */
  appConfigured: boolean;
  /** Whether the server has OAuth client creds configured (client id, secret, redirect uri). */
  oauthConfigured: boolean;
  /** The caller's tenant tier ('free' | 'self-serve' | 'concierge'). */
  tier: TenantTier;
  /** Whether the tenant may connect a live bank feed RIGHT NOW — true for paid
   *  tiers, and for a Free tenant while a 14-day trial is active. This is the
   *  UI's "can connect" signal — the actual enforcement lives in connectAkahu. */
  canConnectLive: boolean;
  /** ISO end of the Free-tier live-sync trial, or null if never started. */
  trialEndsAt: string | null;
  /** Whole days left in the trial (0 if expired, null if no trial started). */
  trialDaysLeft: number | null;
}

export async function getAkahuConnectionStatus(): Promise<AkahuConnectionStatus> {
  const tenant = await requireTenant();
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("akahu_connections")
    .select("status, connected_at, last_synced_at")
    .eq("tenant_id", tenant.id)
    .limit(1);
  if (error) throwServerError(error.message, 400);
  const row = data?.[0] as
    | { status: string; connected_at: string | null; last_synced_at: string | null }
    | undefined;
  const now = new Date();
  return {
    connected: row?.status === "active",
    status: row?.status ?? null,
    connectedAt: row?.connected_at ?? null,
    lastSyncedAt: row?.last_synced_at ?? null,
    appConfigured: appToken() !== null,
    oauthConfigured: oauthConfigured(),
    tier: tenant.tier,
    canConnectLive: canConnectLive(tenant, now),
    trialEndsAt: tenant.trialEndsAt,
    trialDaysLeft: trialDaysLeft(tenant.trialEndsAt, now),
  };
}

/**
 * Store the caller's Akahu user token (Vault) and mark the connection active.
 * This is the actual security boundary for the Free-tier restriction: it is
 * called from every connect path (paste-a-token form today; also the OAuth
 * callback once that flow lands), so gating here — not just in the UI — is
 * what stops a Free tenant from wiring up live sync no matter how the request
 * reaches the server.
 */
export async function connectAkahu(userToken: string): Promise<AkahuConnectionStatus> {
  const tenant = await requireTenant();
  if (!canConnectLive(tenant, new Date())) {
    throwServerError(TIER_RESTRICTED_MESSAGE, 403);
  }

  const clean = userToken.trim();
  if (!clean) throwServerError("Enter your Akahu user token.", 400);

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("connect_akahu", {
    target_tenant: tenant.id,
    user_token: clean,
  });
  if (error) throwServerError(error.message || "Could not save your Akahu connection.", 400);
  return getAkahuConnectionStatus();
}

/**
 * Start the Free tenant's 14-day live-sync trial (no card). Idempotent-safe: the
 * start_trial RPC only sets trial_ends_at when the tenant is 'free' and hasn't
 * trialed before, so repeat calls can't extend or re-arm it. Returns the fresh
 * status so the UI immediately reflects that live connect is now available.
 */
export async function startTrial(): Promise<AkahuConnectionStatus> {
  const tenant = await requireTenant();
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("start_trial", { target_tenant: tenant.id });
  if (error) throwServerError(error.message || "Could not start your trial.", 400);
  return getAkahuConnectionStatus();
}

/** Remove the caller's Akahu token from Vault and revoke the connection. */
export async function disconnectAkahu(): Promise<AkahuConnectionStatus> {
  const tenantId = await requireTenantId();
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("disconnect_akahu", { target_tenant: tenantId });
  if (error) throwServerError(error.message || "Could not disconnect.", 400);
  return getAkahuConnectionStatus();
}

async function userTokenFor(tenantId: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_akahu_user_token", { target_tenant: tenantId });
  if (error) throwServerError(error.message, 400);
  const token = typeof data === "string" ? data : null;
  if (!token) throwServerError("Akahu is not connected. Connect your account first.", 409);
  return token;
}

function buildClient(userToken: string): AkahuClient {
  const app = appToken();
  if (!app) {
    throwServerError(
      "Live Akahu sync is not configured on this server (missing AKAHU_APP_TOKEN).",
      503,
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
    if (err instanceof AkahuApiError) throwServerError(err.message, 502);
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

type SupabaseServerClient = ReturnType<typeof getSupabaseServerClient>;

/** Insert the "running" sync-log row for a new sync attempt; returns its id. */
async function startSyncLog(
  supabase: SupabaseServerClient,
  tenantId: string,
  akahuAccountId: string,
  fromDate: string,
  toDate: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from("akahu_sync_log")
    .insert({
      tenant_id: tenantId,
      akahu_account_id: akahuAccountId,
      from_date: fromDate,
      to_date: toDate,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throwServerError(error.message, 400);
  return (data as { id: string }).id;
}

interface SyncLogOutcome {
  status: "success" | "error";
  transactionsIngested?: number;
  errorMessage?: string;
}

/** Mark a sync-log row finished (success or error) with its outcome. */
async function finishSyncLog(
  supabase: SupabaseServerClient,
  tenantId: string,
  logId: string,
  outcome: SyncLogOutcome,
): Promise<void> {
  await supabase
    .from("akahu_sync_log")
    .update({
      finished_at: new Date().toISOString(),
      status: outcome.status,
      transactions_ingested: outcome.transactionsIngested ?? null,
      error_message: outcome.errorMessage ?? null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", logId);
}

function defaultStartDate(): string {
  return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

/**
 * Pull transactions for one Akahu account over [startDate, endDate] (default
 * start: last 90 days; default end: today, per iterTransactions/Akahu's API)
 * and ingest them into the tenant's ledger. Idempotent via the ingestion
 * dedup. Updates last_synced_at on success, and logs the attempt (date range,
 * outcome, count/error) to akahu_sync_log for the sync-history UI.
 */
export async function syncAkahuAccount(
  accountId: string,
  startDate?: string,
  endDate?: string,
): Promise<AkahuSyncResult> {
  const tenant = await requireTenant();
  // Trial expiry (or a lapsed plan) closes the live feed: existing data stays,
  // but no new pulls run until they add a card. This is the graceful fallback —
  // syncAkahuAccount is a second enforcement point beyond connectAkahu.
  if (!canConnectLive(tenant, new Date())) {
    throwServerError(TRIAL_ENDED_MESSAGE, 403);
  }
  const tenantId = tenant.id;
  const cleanAccount = accountId.trim();
  if (!cleanAccount) throwServerError("Choose an account to sync.", 400);

  const start = startDate ?? defaultStartDate();
  const end = endDate?.trim() || undefined;
  if (end && end < start) {
    throwServerError("The end date must be on or after the start date.", 400);
  }

  const token = await userTokenFor(tenantId);
  const client = buildClient(token);
  const supabase = getSupabaseServerClient();
  const logId = await startSyncLog(supabase, tenantId, cleanAccount, start, end ?? null);

  try {
    const payloads: Record<string, unknown>[] = [];
    for await (const txn of client.iterTransactions(cleanAccount, start, end)) {
      payloads.push(txn);
    }

    const result = await ingestTenantPayloads(payloads);

    await supabase
      .from("akahu_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("tenant_id", tenantId);
    await finishSyncLog(supabase, tenantId, logId, {
      status: "success",
      transactionsIngested: payloads.length,
    });

    return { ...result, accountId: cleanAccount, fetched: payloads.length };
  } catch (err) {
    const message = err instanceof AkahuApiError ? err.message : errorText(err);
    await finishSyncLog(supabase, tenantId, logId, { status: "error", errorMessage: message });
    if (err instanceof AkahuApiError) throwServerError(err.message, 502);
    throw err;
  }
}

export interface AkahuSyncLogEntry {
  id: string;
  akahuAccountId: string;
  startedAt: string;
  finishedAt: string | null;
  fromDate: string | null;
  toDate: string | null;
  transactionsIngested: number | null;
  status: "running" | "success" | "error";
  errorMessage: string | null;
}

interface SyncLogDbRow {
  id: string;
  akahu_account_id: string;
  started_at: string;
  finished_at: string | null;
  from_date: string | null;
  to_date: string | null;
  transactions_ingested: number | null;
  status: string;
  error_message: string | null;
}

function toSyncLogEntry(r: SyncLogDbRow): AkahuSyncLogEntry {
  return {
    id: r.id,
    akahuAccountId: r.akahu_account_id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    fromDate: r.from_date,
    toDate: r.to_date,
    transactionsIngested: r.transactions_ingested,
    status: r.status === "success" || r.status === "error" ? r.status : "running",
    errorMessage: r.error_message,
  };
}

const SYNC_LOG_SELECT_COLS =
  "id, akahu_account_id, started_at, finished_at, from_date, to_date, transactions_ingested, status, error_message";
const SYNC_LOG_LIMIT = 20;

/** Recent sync attempts for the tenant, newest first (optionally one account). */
export async function listSyncLog(accountId?: string): Promise<AkahuSyncLogEntry[]> {
  const tenantId = await requireTenantId();
  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("akahu_sync_log")
    .select(SYNC_LOG_SELECT_COLS)
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(SYNC_LOG_LIMIT);
  const cleanAccountId = accountId?.trim();
  if (cleanAccountId) query = query.eq("akahu_account_id", cleanAccountId);
  const { data, error } = await query;
  if (error) throwServerError(error.message, 400);
  return ((data ?? []) as SyncLogDbRow[]).map(toSyncLogEntry);
}
