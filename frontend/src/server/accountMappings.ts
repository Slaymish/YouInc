// Server-only, tenant-scoped CRUD for Akahu account -> ledger account mappings
// (the DB form of the old rules.yaml `account_mappings` map). Lets a
// self-service user tell the ingestion pipeline which ledger account a synced
// Akahu account should post to, and (for liabilities) what its credit limit
// is, so workspaceLiquidity.ts can compute available credit.
//
// Previously this table was only ever written by the sample-data seeder
// (sampleIngestion.ts) and read by loadTenantRules (tenantIngestion.ts) /
// fetchCreditFacilityMappings (workspaceLiquidity.ts). This module is the
// user-facing CRUD surface for real, non-demo Akahu accounts.
//
// Mapping edits change how FUTURE syncs post transactions — they do not
// retroactively repost existing journals.
import { getSupabaseServerClient, getServerUser } from "./supabaseServer";
import {
  normalizeAccountMappingInput,
  AccountMappingValidationError,
  type AccountMappingInput,
  type AccountMappingType,
} from "./accountMappingValidation";
import { throwServerError } from "./serverError";

export type { AccountMappingInput, AccountMappingType };

export interface AccountMapping {
  id: string;
  akahuAccountId: string;
  ledgerAccount: string;
  accountType: AccountMappingType;
  creditLimitCents: number | null;
  createdAt: string;
  updatedAt: string;
}

interface AccountMappingDbRow {
  id: string;
  akahu_account_id: string;
  ledger_account: string;
  account_type: string;
  credit_limit_cents: string | number | null;
  created_at: string;
  updated_at: string;
}

function toAccountMapping(r: AccountMappingDbRow): AccountMapping {
  return {
    id: r.id,
    akahuAccountId: r.akahu_account_id,
    ledgerAccount: r.ledger_account,
    accountType: r.account_type === "liability" ? "liability" : "asset",
    creditLimitCents:
      r.credit_limit_cents != null ? Number(r.credit_limit_cents) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS =
  "id, akahu_account_id, ledger_account, account_type, credit_limit_cents, created_at, updated_at";

async function requireTenantId(): Promise<string> {
  const user = await getServerUser();
  if (!user) throwServerError("You must be signed in.", 401);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throwServerError(error.message, 400);
  const row = data?.[0] as { id: string } | undefined;
  if (!row) throwServerError("No workspace found. Finish onboarding first.", 409);
  return row.id;
}

/** All of the tenant's account mappings, in creation order. */
export async function listAccountMappings(): Promise<AccountMapping[]> {
  const tenantId = await requireTenantId();
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("account_mappings")
    .select(SELECT_COLS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) throwServerError(error.message, 400);
  return ((data ?? []) as AccountMappingDbRow[]).map(toAccountMapping);
}

// Normalize + validate, mapping the pure AccountMappingValidationError to a
// 400 Response.
function normalizeInput(input: AccountMappingInput): AccountMappingInput {
  try {
    return normalizeAccountMappingInput(input);
  } catch (err) {
    if (err instanceof AccountMappingValidationError) {
      throwServerError(err.message, 400);
    }
    throw err;
  }
}

function dbFields(input: AccountMappingInput, tenantId: string) {
  return {
    tenant_id: tenantId,
    akahu_account_id: input.akahuAccountId,
    ledger_account: input.ledgerAccount,
    account_type: input.accountType,
    credit_limit_cents: input.creditLimitCents,
  };
}

function conflictMessage(akahuAccountId: string): string {
  return `An account mapping for "${akahuAccountId}" already exists.`;
}

/** Create a new account mapping. */
export async function createAccountMapping(
  rawInput: AccountMappingInput,
): Promise<AccountMapping[]> {
  const tenantId = await requireTenantId();
  const input = normalizeInput(rawInput);
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("account_mappings")
    .insert(dbFields(input, tenantId));
  if (error) {
    if (error.code === "23505") {
      throwServerError(conflictMessage(input.akahuAccountId), 409);
    }
    throwServerError(error.message, 400);
  }
  return listAccountMappings();
}

/** Update an existing account mapping by id. */
export async function updateAccountMapping(
  id: string,
  rawInput: AccountMappingInput,
): Promise<AccountMapping[]> {
  const tenantId = await requireTenantId();
  const input = normalizeInput(rawInput);
  const supabase = getSupabaseServerClient();
  const fields = dbFields(input, tenantId);
  const { tenant_id: _t, ...updatable } = fields;
  const { error } = await supabase
    .from("account_mappings")
    .update(updatable)
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      throwServerError(conflictMessage(input.akahuAccountId), 409);
    }
    throwServerError(error.message, 400);
  }
  return listAccountMappings();
}

/** Delete an account mapping. */
export async function deleteAccountMapping(id: string): Promise<AccountMapping[]> {
  const tenantId = await requireTenantId();
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("account_mappings")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throwServerError(error.message, 400);
  return listAccountMappings();
}
