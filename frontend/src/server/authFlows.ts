// Server-only wrappers around the auth_flows SECURITY DEFINER RPCs (migration
// 20260705160000). These run pre-auth (no session yet), through the
// request-cookie Supabase client — the flow token is an unguessable uuid, so
// security rests on possession of the token, not on the caller's identity.
import { getSupabaseServerClient } from "./supabaseServer";
import { throwServerError } from "./serverError";
import {
  isValidEmail,
  normalizeEmail,
  type AuthFlowKind,
} from "./authFlowSteps";

export interface AuthFlow {
  token: string;
  kind: AuthFlowKind;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  step: string;
  hasPasskey: boolean | null;
  userId: string | null;
  challenge: string | null;
}

interface AuthFlowRow {
  token: string;
  kind: AuthFlowKind;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  step: string;
  has_passkey: boolean | null;
  user_id: string | null;
  challenge: string | null;
}

function mapRow(row: AuthFlowRow): AuthFlow {
  return {
    token: row.token,
    kind: row.kind,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    step: row.step,
    hasPasskey: row.has_passkey,
    userId: row.user_id,
    challenge: row.challenge,
  };
}

/** Create a new flow (kind + optional email), returning its token. */
export async function startAuthFlow(
  kind: AuthFlowKind,
  email: string | null,
): Promise<string> {
  if (kind !== "signup" && kind !== "signin") {
    throwServerError("Invalid flow kind.", 400);
  }
  if (email !== null && !isValidEmail(email)) {
    throwServerError("Please enter a valid email address.", 400);
  }
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("start_auth_flow", {
    flow_kind: kind,
    flow_email: email ? normalizeEmail(email) : null,
  });
  if (error) throwServerError(error.message || "Could not start.", 400);
  return data as string;
}

/** Load a flow by token, or null if missing/expired. */
export async function getAuthFlow(token: string): Promise<AuthFlow | null> {
  if (!token) return null;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_auth_flow", {
    flow_token: token,
  });
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as AuthFlowRow | null;
  if (!row || !row.token) return null;
  return mapRow(row);
}

export interface AuthFlowPatch {
  nextStep?: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  hasPasskey?: boolean;
  userId?: string;
  challenge?: string;
}

/** Patch fields / advance the step of an existing flow. Server validates the
 * transition; throws a 400 if the flow expired or the step would jump ahead. */
export async function updateAuthFlow(
  token: string,
  patch: AuthFlowPatch,
): Promise<AuthFlow> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_auth_flow", {
    flow_token: token,
    next_step: patch.nextStep ?? null,
    patch_email: patch.email ?? null,
    patch_first_name: patch.firstName ?? null,
    patch_last_name: patch.lastName ?? null,
    patch_has_passkey: patch.hasPasskey ?? null,
    patch_user_id: patch.userId ?? null,
    patch_challenge: patch.challenge ?? null,
  });
  if (error) {
    throwServerError(error.message || "That step link expired.", 400);
  }
  const row = (Array.isArray(data) ? data[0] : data) as AuthFlowRow;
  return mapRow(row);
}

/** Does this email already have a registered passkey? (signin step 1) */
export async function passkeyExistsForEmail(email: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("passkey_exists_for_email", {
    flow_email: normalizeEmail(email),
  });
  if (error) return false;
  return Boolean(data);
}
