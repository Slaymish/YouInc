import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AkahuOAuthError,
  buildAkahuAuthorizeUrl,
  exchangeAkahuOAuthCode,
  oauthConfigured,
  resolveAkahuCallback,
} from "./akahuOAuth";

const ENV_KEYS = [
  "AKAHU_APP_TOKEN",
  "AKAHU_APP_ID_TOKEN",
  "AKAHU_APP_SECRET",
  "AKAHU_OAUTH_REDIRECT_URI",
  "AKAHU_OAUTH_AUTHORIZE_URL",
  "AKAHU_OAUTH_SCOPES",
  "AKAHU_BASE_URL",
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
});

function configureOAuthEnv() {
  process.env.AKAHU_APP_TOKEN = "app_token_123";
  process.env.AKAHU_APP_SECRET = "shh_super_secret";
  process.env.AKAHU_OAUTH_REDIRECT_URI = "https://example.com/api/akahu/callback";
}

describe("oauthConfigured", () => {
  it("is false when any of client id / secret / redirect uri is missing", () => {
    expect(oauthConfigured()).toBe(false);
    process.env.AKAHU_APP_TOKEN = "app_token_123";
    expect(oauthConfigured()).toBe(false);
    process.env.AKAHU_APP_SECRET = "shh";
    expect(oauthConfigured()).toBe(false);
  });

  it("is true once client id, secret, and redirect uri are all set", () => {
    configureOAuthEnv();
    expect(oauthConfigured()).toBe(true);
  });
});

describe("buildAkahuAuthorizeUrl", () => {
  it("throws a typed error when OAuth is not configured", () => {
    expect(() => buildAkahuAuthorizeUrl("state123")).toThrow(AkahuOAuthError);
  });

  it("assembles the authorize URL with the five required params, correctly encoded", () => {
    configureOAuthEnv();
    const url = new URL(buildAkahuAuthorizeUrl("state with spaces"));
    expect(url.origin + url.pathname).toBe("https://oauth.akahu.nz/");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("app_token_123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.com/api/akahu/callback",
    );
    expect(url.searchParams.get("scope")).toBe("ENDURING_CONSENT ACCOUNTS TRANSACTIONS");
    expect(url.searchParams.get("state")).toBe("state with spaces");
  });

  it("prefers AKAHU_APP_ID_TOKEN over AKAHU_APP_TOKEN for client_id when set", () => {
    configureOAuthEnv();
    process.env.AKAHU_APP_ID_TOKEN = "app_id_override";
    const url = new URL(buildAkahuAuthorizeUrl("s"));
    expect(url.searchParams.get("client_id")).toBe("app_id_override");
  });

  it("honours AKAHU_OAUTH_SCOPES and AKAHU_OAUTH_AUTHORIZE_URL overrides", () => {
    configureOAuthEnv();
    process.env.AKAHU_OAUTH_SCOPES = "ACCOUNTS";
    process.env.AKAHU_OAUTH_AUTHORIZE_URL = "https://mock.example.com/authorize";
    const url = new URL(buildAkahuAuthorizeUrl("s"));
    expect(url.origin + url.pathname).toBe("https://mock.example.com/authorize");
    expect(url.searchParams.get("scope")).toBe("ACCOUNTS");
  });
});

describe("exchangeAkahuOAuthCode", () => {
  it("returns the access_token on a successful exchange", async () => {
    configureOAuthEnv();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ success: true, access_token: "user_token_abc", token_type: "bearer" }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const token = await exchangeAkahuOAuthCode("the_code");
    expect(token).toBe("user_token_abc");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.akahu.io/v1/token");
    expect(init.method).toBe("POST");
    const sentBody = (init.body as URLSearchParams).toString();
    expect(sentBody).toContain("grant_type=authorization_code");
    expect(sentBody).toContain("code=the_code");
    expect(sentBody).toContain("client_secret=shh_super_secret");
  });

  it("throws when the response body has success: false", async () => {
    configureOAuthEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 400 })),
    );
    await expect(exchangeAkahuOAuthCode("the_code")).rejects.toThrow(AkahuOAuthError);
  });

  it("throws when the response is missing access_token", async () => {
    configureOAuthEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
    );
    await expect(exchangeAkahuOAuthCode("the_code")).rejects.toThrow(AkahuOAuthError);
  });

  it("never includes the code or client_secret in a thrown error message", async () => {
    configureOAuthEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 401 })),
    );
    try {
      await exchangeAkahuOAuthCode("super-secret-code-value");
      expect.unreachable("should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).not.toContain("super-secret-code-value");
      expect(message).not.toContain("shh_super_secret");
    }
  });

  it("throws a typed error when OAuth is not configured (no network call made)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(exchangeAkahuOAuthCode("code")).rejects.toThrow(AkahuOAuthError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("resolveAkahuCallback", () => {
  it("resolves to denied when the provider reports an error", () => {
    expect(
      resolveAkahuCallback({ code: null, state: "s", error: "access_denied" }, "s"),
    ).toEqual({ kind: "denied" });
  });

  it("resolves to denied when no code is present", () => {
    expect(resolveAkahuCallback({ code: null, state: "s", error: null }, "s")).toEqual({
      kind: "denied",
    });
  });

  it("resolves to state_mismatch when the cookie is missing", () => {
    expect(resolveAkahuCallback({ code: "c", state: "s", error: null }, null)).toEqual({
      kind: "state_mismatch",
    });
  });

  it("resolves to state_mismatch when state does not match the cookie", () => {
    expect(resolveAkahuCallback({ code: "c", state: "s1", error: null }, "s2")).toEqual({
      kind: "state_mismatch",
    });
  });

  it("resolves to ok with the code when state matches the cookie", () => {
    expect(resolveAkahuCallback({ code: "c", state: "s", error: null }, "s")).toEqual({
      kind: "ok",
      code: "c",
    });
  });
});
