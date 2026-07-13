// Server-only account/tenant operations for the self-service signup + onboarding
// flow. Everything here runs through the request-scoped Supabase client
// (getSupabaseServerClient), so queries execute under the signed-in user's
// Row-Level Security context — no service_role, no RLS bypass.
//
// The multi-tenant Postgres *ledger read* layer is still P2 (see supabase
// README "Deliberately deferred to P2"); these helpers only touch the tenancy
// tables that already exist and are RLS-safe: profiles, tenants, memberships,
// akahu_connections.
import { getSupabaseServerClient, getServerUser } from "./supabaseServer";
import { throwServerError } from "./serverError";

// Tenant-level product tier (billing/plan). 'free' = manual accounts only,
// full widget access, no live Akahu sync — the default for brand-new
// self-registered tenants since migration 20260705150001 (create_tenant used
// to default to 'self-serve'; that's now an explicit, non-schema upgrade).
// 'self-serve' = paid, adds live bank sync via Akahu. 'concierge' = bespoke,
// operator-provisioned. Exported so other server modules (akahuConnection.ts)
// can type their own tenant lookups against the same set of values instead of
// re-declaring the union.
export type TenantTier = "free" | "self-serve" | "concierge";

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  tier: TenantTier;
  defaultCurrency: string;
  /** ISO end of the Free-tier live-sync trial, or null if never started. */
  trialEndsAt: string | null;
}

export interface AccountState {
  userId: string;
  email: string | null;
  displayName: string | null;
  tenant: TenantSummary | null;
  bankConnected: boolean;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  tier: TenantTier;
  default_currency: string;
  trial_ends_at: string | null;
}

/**
 * The current user's account + primary tenant, or null when signed out. A
 * self-service user is a member of exactly one tenant (the one they created at
 * onboarding); if they belong to several we take the first by creation time.
 */
export async function getAccountState(): Promise<AccountState | null> {
  const user = await getServerUser();
  if (!user) return null;

  const supabase = getSupabaseServerClient();

  const { data: tenantRows } = await supabase
    .from("tenants")
    .select("id, name, slug, tier, default_currency, trial_ends_at")
    .order("created_at", { ascending: true })
    .limit(1);

  const row = (tenantRows?.[0] ?? null) as TenantRow | null;
  const tenant: TenantSummary | null = row
    ? {
        id: row.id,
        name: row.name,
        slug: row.slug,
        tier: row.tier,
        defaultCurrency: row.default_currency,
        trialEndsAt: row.trial_ends_at,
      }
    : null;

  let bankConnected = false;
  if (tenant) {
    const { count } = await supabase
      .from("akahu_connections")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    bankConnected = (count ?? 0) > 0;
  }

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    null;

  return {
    userId: user.id,
    email: user.email ?? null,
    displayName,
    tenant,
    bankConnected,
  };
}

/**
 * Creates the caller's tenant via the create_tenant RPC (migration 5) and makes
 * them its owner. Returns the new tenant summary. Throws a 401 Response if the
 * caller is not authenticated, or a 400 with the DB message on validation
 * failure (blank name, etc.).
 */
export async function createTenant(name: string): Promise<TenantSummary> {
  const user = await getServerUser();
  if (!user) {
    throwServerError("You must be signed in to create a workspace.", 401);
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throwServerError("Please enter a name for your workspace.", 400);
  }
  if (trimmed.length > 120) {
    throwServerError("That name is too long (max 120 characters).", 400);
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_tenant", {
    tenant_name: trimmed,
  });

  if (error) {
    throwServerError(error.message || "Could not create your workspace.", 400);
  }

  const row = (Array.isArray(data) ? data[0] : data) as TenantRow;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tier: row.tier,
    defaultCurrency: row.default_currency,
    trialEndsAt: row.trial_ends_at,
  };
}

/** Ends the Supabase session (clears the auth cookies via the SSR client). */
export async function signOutUser(): Promise<void> {
  const supabase = getSupabaseServerClient();
  await supabase.auth.signOut();
}
