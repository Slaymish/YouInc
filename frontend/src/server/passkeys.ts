// Server-only orchestration for passkey signup (registration) and the passkey
// signin bridge (verified assertion → real Supabase session). Ties together:
//   * the request-cookie Supabase client (server session, writes auth cookies)
//   * the service-role client (RLS-bypassing ops that must run pre-session)
//   * the WebAuthn helpers (server/webauthn.ts)
//   * the auth_flows RPCs (server/authFlows.ts)
//
// Imported lazily by the route server functions so none of this reaches the
// client bundle.
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { getSupabaseServerClient } from "./supabaseServer";
import { getSupabaseAdminClient } from "./supabaseAdmin";
import { getAuthFlow, updateAuthFlow } from "./authFlows";
import { throwServerError } from "./serverError";
import {
  buildRegistrationOptions,
  buildAuthenticationOptions,
  verifyRegistration,
  verifyAuthentication,
  bytesToBase64,
  base64ToBytes,
} from "./webauthn";

/** A cryptographically-random throwaway password for passkey-first signup: the
 * account is created with it, then it is discarded (the user authenticates with
 * the passkey, never this password). */
function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes) + "aA1!"; // guarantee complexity requirements
}

/** Convert bytes to the Postgres bytea hex-escape literal PostgREST accepts on
 * insert (e.g. \x1a2b…). */
function toPgByteaHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return "\\x" + hex;
}

export interface BeginRegistrationResult {
  options: Awaited<ReturnType<typeof buildRegistrationOptions>>;
  hasSession: boolean;
}

/**
 * Step 3 "Create a passkey": create the Supabase account (throwaway password),
 * then hand back WebAuthn registration options. `hasSession` reflects whether
 * signUp returned a live session — true in dev (confirmations off), false in
 * prod (confirmations on) — so the client knows whether to route to onboarding
 * or the "check your email" interstitial after registration.
 */
export async function beginPasskeyRegistration(
  token: string,
): Promise<BeginRegistrationResult> {
  const flow = await getAuthFlow(token);
  if (!flow || flow.kind !== "signup" || !flow.email) {
    throwServerError("That signup link expired — start again.", 400);
  }

  const displayName =
    [flow.firstName, flow.lastName].filter(Boolean).join(" ") || null;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: flow.email,
    password: randomPassword(),
    options: { data: displayName ? { display_name: displayName } : undefined },
  });
  if (error || !data.user) {
    throwServerError(error?.message || "Could not create your account.", 400);
  }

  const options = await buildRegistrationOptions({
    userId: data.user.id,
    email: flow.email,
    displayName,
  });

  await updateAuthFlow(token, {
    userId: data.user.id,
    challenge: options.challenge,
  });

  return { options, hasSession: Boolean(data.session) };
}

/**
 * Finish "Create a passkey": verify the attestation and persist the credential
 * via the SERVICE-ROLE client (prod has no session yet, so this can't run under
 * RLS). Returns whether a live session exists (dev) so the client can route.
 */
export async function finishPasskeyRegistration(
  token: string,
  response: RegistrationResponseJSON,
): Promise<{ hasSession: boolean }> {
  const flow = await getAuthFlow(token);
  if (!flow || !flow.userId || !flow.challenge) {
    throwServerError("That signup link expired — start again.", 400);
  }

  const verified = await verifyRegistration({
    response,
    expectedChallenge: flow.challenge,
  });

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("passkey_credentials").insert({
    user_id: flow.userId,
    credential_id: verified.credentialId,
    public_key: toPgByteaHex(verified.publicKey),
    counter: verified.counter,
    transports: verified.transports ?? null,
  } as never);
  if (error) {
    throwServerError(error.message || "Could not save your passkey.", 400);
  }

  // Does the caller currently hold a live session? (dev = yes, prod = no)
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { hasSession: Boolean(user) };
}

/**
 * Fallback when the passkey ceremony fails/cancels on step 3: the account
 * already exists (created in beginPasskeyRegistration), so set its password via
 * the service-role admin API (works with or without a session). No passkey row
 * is written.
 */
export async function setSignupPassword(
  token: string,
  password: string,
): Promise<{ hasSession: boolean }> {
  if (password.length < 8) {
    throwServerError("Use at least 8 characters for your password.", 400);
  }
  const flow = await getAuthFlow(token);
  if (!flow || !flow.userId) {
    throwServerError("That signup link expired — start again.", 400);
  }
  const admin = getSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(flow.userId, {
    password,
  });
  if (error) {
    throwServerError(error.message || "Could not set your password.", 400);
  }
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { hasSession: Boolean(user) };
}

/**
 * "Use a password instead" branch: an ordinary signUp with a user-chosen
 * password, no passkey row. Returns whether a live session was minted (dev) so
 * the client routes to onboarding vs. "check your email".
 */
export async function passwordSignup(
  token: string,
  password: string,
): Promise<{ hasSession: boolean }> {
  if (password.length < 8) {
    throwServerError("Use at least 8 characters for your password.", 400);
  }
  const flow = await getAuthFlow(token);
  if (!flow || flow.kind !== "signup" || !flow.email) {
    throwServerError("That signup link expired — start again.", 400);
  }
  const displayName =
    [flow.firstName, flow.lastName].filter(Boolean).join(" ") || null;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: flow.email,
    password,
    options: { data: displayName ? { display_name: displayName } : undefined },
  });
  if (error) {
    throwServerError(error.message || "Could not create your account.", 400);
  }
  return { hasSession: Boolean(data.session) };
}

/** Generate WebAuthn authentication options and stash the challenge on the flow
 * (used for both conditional-UI autofill and the explicit "Continue with
 * passkey" button). */
export async function beginPasskeyAuthentication(token: string) {
  const flow = await getAuthFlow(token);
  if (!flow) {
    throwServerError("That signin link expired — start again.", 400);
  }
  const options = await buildAuthenticationOptions();
  await updateAuthFlow(token, { challenge: options.challenge });
  return options;
}

/**
 * Turn a verified passkey assertion into a real Supabase session:
 *   1. look up the credential (pre-auth RPC), verify signature + counter;
 *   2. bump the stored counter / last_used_at;
 *   3. mint a magic-link token via the service-role admin API;
 *   4. verifyOtp on the request-cookie client → writes the session cookies.
 */
export async function finishPasskeyAuthentication(
  token: string,
  response: AuthenticationResponseJSON,
): Promise<{ ok: true }> {
  const flow = await getAuthFlow(token);
  if (!flow || !flow.challenge) {
    throwServerError("That signin link expired — start again.", 400);
  }

  const supabase = getSupabaseServerClient();

  const { data: found, error: lookupError } = await supabase.rpc(
    "find_passkey_credential",
    { cred_id: response.id },
  );
  const row = (Array.isArray(found) ? found[0] : found) as
    | {
        user_id: string;
        email: string;
        public_key_b64: string;
        counter: number;
        transports: string[] | null;
      }
    | null
    | undefined;
  if (lookupError || !row) {
    throwServerError("No passkey found for this device.", 400);
  }

  const verified = await verifyAuthentication({
    response,
    expectedChallenge: flow.challenge,
    credential: {
      id: response.id,
      publicKey: base64ToBytes(row.public_key_b64),
      counter: Number(row.counter),
      transports: (row.transports ?? undefined) as never,
    },
  });

  await supabase.rpc("bump_passkey_credential", {
    cred_id: response.id,
    new_counter: verified.newCounter,
  });

  // Bridge to a session: no direct "assertion → session" API in Supabase, so
  // mint a magic-link token (service role) and redeem it on the request-cookie
  // client, which writes the session cookies via the existing setAll plumbing.
  const admin = getSupabaseAdminClient();
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: row.email,
    });
  const hashedToken = (
    linkData?.properties as { hashed_token?: string } | undefined
  )?.hashed_token;
  if (linkError || !hashedToken) {
    throwServerError("Could not complete sign in — try again.", 400);
  }

  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  });
  if (otpError) {
    throwServerError(otpError.message || "Could not complete sign in.", 400);
  }

  return { ok: true };
}
