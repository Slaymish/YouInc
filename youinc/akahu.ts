import { parseAkahuAccount, type AkahuAccountPayload, type ParsedAkahuAccount } from './balances.ts';

/**
 * Akahu REST client, ported from frontend/src/server/akahuClient.ts.
 *
 * Credentials come from the environment only, never from arguments or files in
 * the repo: AKAHU_APP_TOKEN (identifies the app) and AKAHU_USER_TOKEN
 * (authorises the account holder's data). Both are server-side secrets.
 */
export interface AkahuConfig {
  appToken: string;
  userToken: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class AkahuError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'AkahuError';
    this.status = status;
  }
}

export function akahuConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AkahuConfig {
  const appToken = env.AKAHU_APP_TOKEN?.trim();
  const userToken = env.AKAHU_USER_TOKEN?.trim();
  if (!appToken || !userToken) {
    throw new AkahuError(
      'Akahu credentials are missing. Set AKAHU_APP_TOKEN and AKAHU_USER_TOKEN in the environment ' +
        '(or frontend/.env.local) — they are never read from source or committed.',
    );
  }
  return { appToken, userToken, baseUrl: env.AKAHU_BASE_URL?.trim() || 'https://api.akahu.io/v1' };
}

export class AkahuClient {
  private readonly config: Required<Pick<AkahuConfig, 'appToken' | 'userToken' | 'baseUrl'>>;
  private readonly fetchFn: typeof fetch;

  constructor(config: AkahuConfig) {
    this.config = {
      appToken: config.appToken,
      userToken: config.userToken,
      baseUrl: (config.baseUrl ?? 'https://api.akahu.io/v1').replace(/\/$/, ''),
    };
    this.fetchFn = config.fetchFn ?? fetch;
  }

  private async request(path: string, init: { method?: string; query?: Record<string, string | number | undefined | null> } = {}): Promise<Record<string, unknown>> {
    const url = new URL(`${this.config.baseUrl}${path}`);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const response = await this.fetchFn(url.toString(), {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.config.userToken}`,
        'X-Akahu-Id': this.config.appToken,
        Accept: 'application/json',
      },
    });
    const text = await response.text();
    if (response.status === 401) throw new AkahuError('Akahu rejected the credentials (401). Re-issue the user token.', 401);
    if (response.status === 403) throw new AkahuError('Akahu refused this app access to the account (403).', 403);
    if (response.status === 429) throw new AkahuError('Akahu rate limit hit (429); retry shortly.', 429);
    if (response.status >= 400) throw new AkahuError(`Akahu API error ${response.status}: ${text.slice(0, 300)}`, response.status);
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new AkahuError(`Akahu returned non-JSON (${response.status}): ${text.slice(0, 200)}`, response.status);
    }
  }

  private static items(payload: Record<string, unknown>): Record<string, unknown>[] {
    const items = payload.items ?? payload.data ?? payload.transactions ?? payload.accounts;
    return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
  }

  private static nextCursor(payload: Record<string, unknown>): string | null {
    const meta = payload.meta as Record<string, unknown> | undefined;
    const cursor = (meta?.cursor as Record<string, unknown> | undefined)?.next ?? payload.next;
    return typeof cursor === 'string' && cursor ? cursor : null;
  }

  /** Every account Akahu has for this user, with balances and refresh times. */
  async accounts(): Promise<ParsedAkahuAccount[]> {
    const payload = await this.request('/accounts');
    const accounts = AkahuClient.items(payload).map((item) => parseAkahuAccount(item as AkahuAccountPayload));
    // Whether an authorisation can be used to verify transfers depends on any
    // of its accounts having a feed, which is only knowable across the set.
    const fedConnections = new Set(accounts.filter((a) => a.hasFeed && a.connectionId).map((a) => a.connectionId));
    for (const account of accounts) {
      account.connectionHasFeed = Boolean(account.connectionId && fedConnections.has(account.connectionId));
    }
    return accounts;
  }

  /** Ask Akahu to refresh balances from the bank now (POST /refresh). */
  async refresh(): Promise<void> {
    await this.request('/refresh', { method: 'POST' });
  }

  /** All transactions for an account in a date range, following the cursor. */
  async *transactions(accountId: string, start?: string, end?: string, limit = 100): AsyncGenerator<Record<string, unknown>> {
    let cursor: string | null = null;
    for (let page = 0; page < 1000; page += 1) {
      const payload = await this.request(`/accounts/${encodeURIComponent(accountId)}/transactions`, {
        query: { start, end, limit, cursor },
      });
      for (const item of AkahuClient.items(payload)) yield item;
      cursor = AkahuClient.nextCursor(payload);
      if (!cursor) break;
    }
  }
}
