// Server-only, tenant-scoped CRUD for classification rules. Lets a self-service
// user view and edit the rules that route their transactions to ledger accounts
// (the DB form of the old rules.yaml `rules:` list). All access runs under the
// caller's RLS context via the Supabase server client — never service_role.
//
// Routing semantics (see server/ledger-engine/rulesRouter.ts): rules are tried
// in (priority ASC, seq ASC) order; the first whose match conditions all pass
// wins; unmatched transactions fall back to NZFCC mappings then the suspense
// account. Editing rules changes how FUTURE ingests/syncs classify — it does not
// retroactively re-post existing journals (reclassify is a later slice).
import { getSupabaseServerClient, getServerUser } from "./supabaseServer";
import {
  normalizeRuleInput,
  RuleValidationError,
  type RuleInput,
} from "./ruleValidation";
import { throwServerError } from "./serverError";

export type { RuleInput };

export interface ClassificationRule {
  id: string;
  ruleKey: string;
  seq: number;
  priority: number;
  isEnabled: boolean;
  matchDescriptionRegex: string | null;
  matchMerchantRegex: string | null;
  matchAmountGreaterThan: number | null;
  matchAmountAbsGreaterThan: number | null;
  targetAccount: string;
  memo: string | null;
}

interface RuleDbRow {
  id: string;
  rule_key: string;
  seq: number;
  priority: number;
  is_enabled: boolean;
  match_description_regex: string | null;
  match_merchant_regex: string | null;
  match_amount_greater_than: string | number | null;
  match_amount_abs_greater_than: string | number | null;
  route_target_account: string;
  route_memo: string | null;
}

function toRule(r: RuleDbRow): ClassificationRule {
  return {
    id: r.id,
    ruleKey: r.rule_key,
    seq: r.seq,
    priority: r.priority,
    isEnabled: r.is_enabled,
    matchDescriptionRegex: r.match_description_regex,
    matchMerchantRegex: r.match_merchant_regex,
    matchAmountGreaterThan:
      r.match_amount_greater_than != null
        ? Number(r.match_amount_greater_than)
        : null,
    matchAmountAbsGreaterThan:
      r.match_amount_abs_greater_than != null
        ? Number(r.match_amount_abs_greater_than)
        : null,
    targetAccount: r.route_target_account,
    memo: r.route_memo,
  };
}

const SELECT_COLS =
  "id, rule_key, seq, priority, is_enabled, match_description_regex, match_merchant_regex, match_amount_greater_than, match_amount_abs_greater_than, route_target_account, route_memo";

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

/** All of the tenant's rules in routing order (priority ASC, seq ASC). */
export async function listRules(): Promise<ClassificationRule[]> {
  const tenantId = await requireTenantId();
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("classification_rules")
    .select(SELECT_COLS)
    .eq("tenant_id", tenantId)
    .order("priority", { ascending: true })
    .order("seq", { ascending: true });
  if (error) throwServerError(error.message, 400);
  return ((data ?? []) as RuleDbRow[]).map(toRule);
}

// Normalize + validate, mapping the pure RuleValidationError to a 400 Response.
function normalizeInput(input: RuleInput): RuleInput {
  try {
    return normalizeRuleInput(input);
  } catch (err) {
    if (err instanceof RuleValidationError) {
      throwServerError(err.message, 400);
    }
    throw err;
  }
}

function dbFields(input: RuleInput, tenantId: string) {
  return {
    tenant_id: tenantId,
    rule_key: input.ruleKey,
    priority: Math.round(input.priority),
    is_enabled: input.isEnabled,
    match_description_regex: input.matchDescriptionRegex?.trim() || null,
    match_merchant_regex: input.matchMerchantRegex?.trim() || null,
    match_amount_greater_than: input.matchAmountGreaterThan,
    match_amount_abs_greater_than: input.matchAmountAbsGreaterThan,
    route_target_account: input.targetAccount,
    route_memo: input.memo?.trim() || null,
  };
}

/** Create a new rule. Picks the next free seq for the tenant (insertion order). */
export async function createRule(
  rawInput: RuleInput,
): Promise<ClassificationRule[]> {
  const tenantId = await requireTenantId();
  const input = normalizeInput(rawInput);
  const supabase = getSupabaseServerClient();

  // Next seq = max(seq)+1 for this tenant (seq is the declaration-order tiebreak
  // and is unique per tenant).
  const { data: maxRows, error: maxErr } = await supabase
    .from("classification_rules")
    .select("seq")
    .eq("tenant_id", tenantId)
    .order("seq", { ascending: false })
    .limit(1);
  if (maxErr) throwServerError(maxErr.message, 400);
  const nextSeq =
    ((maxRows?.[0] as { seq: number } | undefined)?.seq ?? -1) + 1;

  const { error } = await supabase
    .from("classification_rules")
    .insert({ ...dbFields(input, tenantId), seq: nextSeq });
  if (error) {
    if (error.code === "23505") {
      throwServerError(`A rule named "${input.ruleKey}" already exists.`, 409);
    }
    throwServerError(error.message, 400);
  }
  return listRules();
}

/** Update an existing rule by id (rule_key is not editable — it's the key). */
export async function updateRule(
  id: string,
  rawInput: RuleInput,
): Promise<ClassificationRule[]> {
  const tenantId = await requireTenantId();
  const input = normalizeInput(rawInput);
  const supabase = getSupabaseServerClient();
  const fields = dbFields(input, tenantId);
  // rule_key stays as-is on update to avoid unique-key churn; drop it here.
  const { rule_key: _ignore, tenant_id: _t, ...updatable } = fields;
  const { error } = await supabase
    .from("classification_rules")
    .update(updatable)
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throwServerError(error.message, 400);
  return listRules();
}

/** Toggle a rule enabled/disabled without a full edit. */
export async function setRuleEnabled(
  id: string,
  isEnabled: boolean,
): Promise<ClassificationRule[]> {
  const tenantId = await requireTenantId();
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("classification_rules")
    .update({ is_enabled: isEnabled })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throwServerError(error.message, 400);
  return listRules();
}

/** Delete a rule. */
export async function deleteRule(id: string): Promise<ClassificationRule[]> {
  const tenantId = await requireTenantId();
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("classification_rules")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throwServerError(error.message, 400);
  return listRules();
}
