import { afterEach, describe, expect, it, vi } from "vitest";
import { AkahuApiError, AkahuClient } from "./akahuClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

function client(): AkahuClient {
  return new AkahuClient({
    appToken: "app_token_test",
    userToken: "user_token_test",
  });
}

describe("AkahuClient.revokeToken", () => {
  it("revokes the user token with Akahu's required authentication headers", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await client().revokeToken();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.akahu.io/v1/token");
    expect(init.method).toBe("DELETE");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer user_token_test",
      "X-Akahu-ID": "app_token_test",
    });
  });

  it("treats an already-revoked token as success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await expect(client().revokeToken()).resolves.toBeUndefined();
  });

  it("keeps a retryable failure visible instead of pretending access was revoked", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    await expect(client().revokeToken()).rejects.toMatchObject({
      name: "AkahuApiError",
      status: 500,
    } satisfies Partial<AkahuApiError>);
  });
});
