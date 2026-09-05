// Optional personal Akahu credentials stay in the server environment.
import { randomUUID } from 'node:crypto';
import { rows, execute, setting, setSetting } from './database';
import { AkahuClient } from './akahuClient';
import { ingestPayloads, type IngestResult } from './ingestion';
export interface AkahuConnectionStatus {
  connected: boolean; status: string | null; connectedAt: string | null;
  lastSyncedAt: string | null; appConfigured: boolean; oauthConfigured: boolean;
}
export async function getAkahuConnectionStatus(): Promise<AkahuConnectionStatus> {
  const connected = Boolean(process.env.AKAHU_APP_TOKEN && process.env.AKAHU_USER_TOKEN) && setting('akahu_disabled') !== '1';
  const last = rows<{finished_at: string}>("SELECT finished_at FROM akahu_sync_log WHERE status='success' ORDER BY finished_at DESC LIMIT 1")[0];
  return {connected, status: connected ? 'active' : null, connectedAt: null,
    lastSyncedAt: last?.finished_at ?? null, appConfigured: Boolean(process.env.AKAHU_APP_TOKEN), oauthConfigured: false};
}
function client(): AkahuClient {
  if (setting('akahu_disabled') === '1' || !process.env.AKAHU_APP_TOKEN || !process.env.AKAHU_USER_TOKEN) {
    throw new Error('Add your personal Akahu credentials to enable bank sync.');
  }
  return new AkahuClient({baseUrl: process.env.AKAHU_BASE_URL || 'https://api.akahu.io/v1',
    appToken: process.env.AKAHU_APP_TOKEN, userToken: process.env.AKAHU_USER_TOKEN});
}
export async function disconnectAkahu(): Promise<AkahuConnectionStatus> {
  await client().revokeToken();
  setSetting('akahu_disabled', '1');
  return getAkahuConnectionStatus();
}
export async function enableAkahu(): Promise<AkahuConnectionStatus> {
  setSetting('akahu_disabled', '0');
  return getAkahuConnectionStatus();
}
export interface AkahuAccountSummary { id: string; name: string; status: string | null; }
export async function listConnectedAccounts(): Promise<AkahuAccountSummary[]> {
  return (await client().listAccounts()).map(a => ({id: String(a._id ?? a.id ?? ''),
    name: String(a.name ?? a._id ?? 'Bank account'), status: typeof a.status === 'string' ? a.status : null}));
}
export interface AkahuSyncResult extends IngestResult { accountId: string; fetched: number; }
export interface AkahuSyncLogEntry {
  id: string; akahuAccountId: string; startedAt: string; finishedAt: string | null;
  fromDate: string | null; toDate: string | null; transactionsIngested: number | null;
  status: 'running' | 'success' | 'error'; errorMessage: string | null;
}
export async function listSyncLog(accountId?: string): Promise<AkahuSyncLogEntry[]> {
  return rows<AkahuSyncLogEntry>(`SELECT id, akahu_account_id AS akahuAccountId, started_at AS startedAt,
    finished_at AS finishedAt, from_date AS fromDate, to_date AS toDate, transactions_ingested AS transactionsIngested,
    status, error_message AS errorMessage FROM akahu_sync_log ${accountId ? 'WHERE akahu_account_id=?' : ''}
    ORDER BY started_at DESC LIMIT 20`, ...(accountId ? [accountId] : []));
}
export async function syncAkahuAccount(accountId: string, startDate?: string, endDate?: string): Promise<AkahuSyncResult> {
  const api = client();
  const start = startDate || new Date(Date.now()-90*86400000).toISOString().slice(0,10);
  const end = endDate || new Date().toISOString().slice(0,10);
  for (const date of [start,end]) if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error('Enter valid sync dates.');
  if (end < start || !accountId.trim()) throw new Error('Choose an account and a valid date range.');
  const id = randomUUID();
  execute(`INSERT INTO akahu_sync_log (id,akahu_account_id,started_at,from_date,to_date,status) VALUES (?,?,?,?,?,'running')`, id, accountId, new Date().toISOString(), start, end);
  try {
    const payloads: Record<string,unknown>[] = [];
    for await (const txn of api.iterTransactions(accountId,start,end)) payloads.push(txn);
    const result = await ingestPayloads(payloads);
    execute("UPDATE akahu_sync_log SET status='success',finished_at=?,transactions_ingested=? WHERE id=?", new Date().toISOString(), result.posted, id);
    return {...result, accountId, fetched: payloads.length};
  } catch (error) {
    execute("UPDATE akahu_sync_log SET status='error',finished_at=?,error_message=? WHERE id=?", new Date().toISOString(), 'Sync failed. Check credentials, account mapping and connection, then retry.', id);
    throw error;
  }
}
