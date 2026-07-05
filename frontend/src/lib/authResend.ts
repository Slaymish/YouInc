// Classifies a Supabase Auth error into a small set of actionable buckets so
// UI code can branch on *meaning* instead of poking at SDK internals.
//
// Signal used, in order of preference:
//   1. `error.code` — the stable GoTrue error code (added to auth-js's
//      `AuthApiError`/`AuthError` from @supabase/auth-js ^2.x, see
//      `node_modules/@supabase/auth-js/src/lib/error-codes.ts` for the
//      authoritative list of `ErrorCode` values in the installed version).
//        - 'email_not_confirmed'        -> 'unverified'
//        - 'invalid_credentials'        -> 'invalid_credentials'
//        - 'over_email_send_rate_limit',
//          'over_request_rate_limit',
//          'over_sms_send_rate_limit'   -> 'rate_limited'
//   2. `error.status` — HTTP status the GoTrue REST API responded with.
//      Rate limiting always comes back as 429, so this catches rate limits
//      even if a future/older SDK version omits or renames the code.
//   3. `error.message` — last-resort substring match for older SDK versions
//      (pre-code AuthApiError) or servers that don't send a `code` field.
//
// This intentionally never throws and never assumes the input is an
// AuthError instance — callers pass whatever `error` came back from a
// Supabase call, which is typed `unknown` at the call site.
export type AuthErrorKind =
  | "unverified"
  | "invalid_credentials"
  | "rate_limited"
  | "other";

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "over_sms_send_rate_limit",
]);

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function classifyAuthError(error: unknown): AuthErrorKind {
  if (!error || typeof error !== "object") {
    return "other";
  }

  const code = readString((error as { code?: unknown }).code);
  const status = readNumber((error as { status?: unknown }).status);
  const message = readString((error as { message?: unknown }).message);

  if (code === "email_not_confirmed") {
    return "unverified";
  }
  if (code === "invalid_credentials") {
    return "invalid_credentials";
  }
  if (RATE_LIMIT_CODES.has(code)) {
    return "rate_limited";
  }

  // Fallback for SDK/server versions that respond without a `code` field.
  if (/email not confirmed/i.test(message)) {
    return "unverified";
  }
  if (/invalid login credentials/i.test(message)) {
    return "invalid_credentials";
  }
  if (status === 429 || /rate limit/i.test(message)) {
    return "rate_limited";
  }

  return "other";
}
