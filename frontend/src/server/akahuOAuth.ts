// Pure Akahu OAuth2 (authorization-code) helpers: env-driven config
// resolution, the authorize-URL builder, the code -> token exchange, and the
// callback's pure CSRF/state decision logic.
//
// Deliberately free of "~/..." path-alias and @supabase/@tanstack imports so
// it can be unit-tested directly under vitest's plain node environment (see
// CLAUDE.md: path aliases and the Start/Supabase runtime are not available
// there — that's why pure logic modules like accountType.ts/workspaceSummary.ts
// stay import-light).
//
// SECURITY: never log or otherwise expose `code`, `client_secret`, or the
// returned access_token anywhere in this file (error messages included).

function envValue(name: string): string | null {
  return process.env[name]?.trim() || null;
}

/** The Akahu APP token — also used as X-Akahu-Id in akahuClient.ts. */
export function appToken(): string | null {
  return envValue("AKAHU_APP_TOKEN");
}

export function akahuBaseUrl(): string {
  return envValue("AKAHU_BASE_URL") ?? "https://api.akahu.io/v1";
}

/** OAuth client_id. Defaults to the APP token (same value Akahu expects). */
export function clientId(): string | null {
  return envValue("AKAHU_APP_ID_TOKEN") ?? appToken();
}

export function appSecret(): string | null {
  return envValue("AKAHU_APP_SECRET");
}

export function oauthRedirectUri(): string | null {
  return envValue("AKAHU_OAUTH_REDIRECT_URI");
}

export function oauthAuthorizeUrl(): string {
  return envValue("AKAHU_OAUTH_AUTHORIZE_URL") ?? "https://oauth.akahu.nz";
}

const DEFAULT_OAUTH_SCOPES = "ENDURING_CONSENT ACCOUNTS TRANSACTIONS";

export function oauthScopes(): string {
  return envValue("AKAHU_OAUTH_SCOPES") ?? DEFAULT_OAUTH_SCOPES;
}

/** Whether enough server config exists to run the OAuth flow at all. */
export function oauthConfigured(): boolean {
  return clientId() !== null && appSecret() !== null && oauthRedirectUri() !== null;
}

export class AkahuOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AkahuOAuthError";
  }
}

/** Build the `GET https://oauth.akahu.nz` authorize URL for a given CSRF state. */
export function buildAkahuAuthorizeUrl(state: string): string {
  if (!oauthConfigured()) {
    throw new AkahuOAuthError(
      "Akahu OAuth is not configured (missing AKAHU_APP_SECRET, AKAHU_OAUTH_REDIRECT_URI, " +
        "or a client id).",
    );
  }
  const url = new URL(oauthAuthorizeUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId() as string);
  url.searchParams.set("redirect_uri", oauthRedirectUri() as string);
  url.searchParams.set("scope", oauthScopes());
  url.searchParams.set("state", state);
  return url.toString();
}

interface AkahuTokenResponse {
  success?: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
}

/**
 * Exchange an authorization `code` for the caller's enduring Akahu user
 * token. Per Akahu's docs this must happen within 60s of the authorize
 * redirect. Never logs `code` or `client_secret` — including in thrown
 * error messages.
 */
export async function exchangeAkahuOAuthCode(code: string): Promise<string> {
  if (!oauthConfigured()) {
    throw new AkahuOAuthError("Akahu OAuth is not configured.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: oauthRedirectUri() as string,
    client_id: clientId() as string,
    client_secret: appSecret() as string,
  });

  let response: Response;
  try {
    response = await fetch(`${akahuBaseUrl()}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error";
    throw new AkahuOAuthError(`Could not reach the Akahu token endpoint: ${message}`);
  }

  let payload: AkahuTokenResponse;
  try {
    payload = (await response.json()) as AkahuTokenResponse;
  } catch {
    throw new AkahuOAuthError(
      `Akahu token endpoint returned an unreadable response (status ${response.status}).`,
    );
  }

  if (!response.ok || payload.success === false) {
    throw new AkahuOAuthError(`Akahu token exchange failed (status ${response.status}).`);
  }
  if (!payload.access_token) {
    throw new AkahuOAuthError("Akahu token exchange did not return an access token.");
  }
  return payload.access_token;
}

export type AkahuCallbackOutcome =
  | { kind: "denied" }
  | { kind: "state_mismatch" }
  | { kind: "ok"; code: string };

export interface AkahuCallbackQuery {
  code: string | null;
  state: string | null;
  error: string | null;
}

/**
 * Pure decision logic for GET /api/akahu/callback: validates the `error`/
 * `code` presence and the CSRF state-cookie match *before* any network call
 * is made. Extracted so the branching is unit-testable without a server.
 */
export function resolveAkahuCallback(
  query: AkahuCallbackQuery,
  cookieState: string | null,
): AkahuCallbackOutcome {
  if (query.error || !query.code) return { kind: "denied" };
  if (!query.state || !cookieState || query.state !== cookieState) {
    return { kind: "state_mismatch" };
  }
  return { kind: "ok", code: query.code };
}
