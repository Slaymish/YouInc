// Server-only TypeScript Akahu API client — a faithful port of the Python
// AkahuClient (src/youinc_ledger/ingest_service/akahu_client.py): same headers
// (Bearer user_token + X-Akahu-ID app_token), same pagination cursor handling,
// same actionable error messages. Used by the multi-tenant live-sync path so
// self-service tenants can pull transactions without shelling to Python.
//
// Auth model: Akahu personal apps authenticate with an app token (server env,
// shared) + an enduring per-user user token (stored per-tenant in Vault — see
// migration 20260704120006). This is exactly what the Python CLI uses.

export class AkahuApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "AkahuApiError";
    this.status = status;
  }
}

export interface AkahuClientOptions {
  baseUrl?: string;
  appToken: string;
  userToken: string;
  rateLimitSeconds?: number;
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = "https://api.akahu.io/v1";

function extractItems(payload: Record<string, unknown>): Record<string, unknown>[] {
  for (const key of ["items", "transactions", "accounts", "data"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
  }
  return [];
}

function extractNextCursor(payload: Record<string, unknown>): string | null {
  const cursor = payload.cursor;
  if (cursor && typeof cursor === "object") {
    const c = cursor as Record<string, unknown>;
    const next = c.next ?? c.after;
    return next ? String(next) : null;
  }
  const next = payload.next ?? payload.next_cursor;
  return next ? String(next) : null;
}

export class AkahuClient {
  private readonly baseUrl: string;
  private readonly appToken: string;
  private readonly userToken: string;
  private readonly rateLimitMs: number;
  private readonly timeoutMs: number;

  constructor(opts: AkahuClientOptions) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.appToken = opts.appToken;
    this.userToken = opts.userToken;
    this.rateLimitMs = Math.round((opts.rateLimitSeconds ?? 0.25) * 1000);
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  private headers(): Record<string, string> {
    if (!this.appToken || !this.userToken) {
      throw new AkahuApiError(
        "Missing Akahu credentials. The server needs an app token (AKAHU_APP_TOKEN) " +
          "and the connection needs a user token.",
      );
    }
    return {
      Accept: "application/json",
      Authorization: `Bearer ${this.userToken}`,
      "X-Akahu-ID": this.appToken,
    };
  }

  private async get(
    path: string,
    params: Record<string, string | number | null | undefined>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, { headers: this.headers(), signal: controller.signal });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (controller.signal.aborted) {
        throw new AkahuApiError(`Akahu request timed out after ${this.timeoutMs}ms.`);
      }
      throw new AkahuApiError(`Could not reach Akahu: ${message}`);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401) {
      throw new AkahuApiError(
        "Akahu returned 401 Unauthorized. Your Akahu user token may be wrong or revoked — reconnect it.",
        response.status,
      );
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After") ?? "unknown";
      throw new AkahuApiError(`Akahu rate limit exceeded. Retry-After: ${retryAfter}`);
    }
    if (response.status >= 500) {
      const body = (await response.text()).slice(0, 500);
      throw new AkahuApiError(`Akahu server error ${response.status}: ${body}`);
    }
    if (response.status >= 400) {
      const body = (await response.text()).slice(0, 500);
      if (response.status === 400 && body.includes("pathParams.id")) {
        throw new AkahuApiError(
          "Akahu rejected the account id. Use the Akahu account identifier from /accounts " +
            "(usually starts with 'acc_'), not the bank name.",
        );
      }
      throw new AkahuApiError(`Akahu API error ${response.status}: ${body}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }

  /**
   * Revoke this user's enduring access at Akahu. A 401 means the token was
   * already revoked externally, so the desired end state has been reached.
   */
  async revokeToken(): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/token`, {
        method: "DELETE",
        headers: this.headers(),
        signal: controller.signal,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (controller.signal.aborted) {
        throw new AkahuApiError(`Akahu revocation timed out after ${this.timeoutMs}ms.`);
      }
      throw new AkahuApiError(`Could not reach Akahu to revoke access: ${message}`);
    } finally {
      clearTimeout(timer);
    }

    if (response.ok || response.status === 401) return;
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After") ?? "unknown";
      throw new AkahuApiError(
        `Akahu rate limit exceeded while revoking access. Retry-After: ${retryAfter}`,
        response.status,
      );
    }
    throw new AkahuApiError(
      `Akahu could not revoke access (status ${response.status}). Please try again.`,
      response.status,
    );
  }

  async listAccounts(): Promise<Record<string, unknown>[]> {
    return extractItems(await this.get("/accounts", {}));
  }

  /** Yield all transactions for an account, following the pagination cursor. */
  async *iterTransactions(
    accountId: string,
    startDate?: string,
    endDate?: string,
    limit = 100,
  ): AsyncGenerator<Record<string, unknown>> {
    let cursor: string | null = null;
    // Hard cap on pages so a misbehaving cursor can't loop forever.
    for (let page = 0; page < 1000; page++) {
      const payload = await this.get(`/accounts/${accountId}/transactions`, {
        start: startDate,
        end: endDate,
        limit,
        cursor,
      });
      for (const item of extractItems(payload)) yield item;
      cursor = extractNextCursor(payload);
      if (!cursor) break;
      if (this.rateLimitMs > 0) await new Promise((r) => setTimeout(r, this.rateLimitMs));
    }
  }
}
