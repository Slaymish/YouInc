import { createHash } from 'node:crypto';

/**
 * Raw transaction normalisation, ported from
 * frontend/src/server/ledger-engine/rawTransaction.ts.
 *
 * The idempotency hash is the dedup key: it must be stable across runs or the
 * same bank transaction posts twice. Kept byte-compatible in shape with the
 * original so a ledger imported from it still dedupes.
 */
export type Side = 'debit' | 'credit';

export type RawTransaction = {
  idempotencyHash: string;
  akahuTransactionId: string | null;
  accountId: string;
  status: string;
  amountCents: number;
  currency: string;
  transactionDate: string;
  settlementDate: string | null;
  description: string;
  merchantName: string | null;
  nzfcc: string | null;
  isPending: boolean;
  rawJson: string;
};

type Json = unknown;

/** Python truthiness: None/""/0/[]/{}/false are falsy. */
export function pyTruthy(v: Json): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.length > 0;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  return true;
}

function pyOr(...values: Json[]): Json {
  for (const v of values) if (pyTruthy(v)) return v;
  return values[values.length - 1];
}

function get(raw: Record<string, Json>, key: string): Json {
  return Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : undefined;
}

/** Decimal → integer cents, ROUND_HALF_UP (ties away from zero). */
export function decimalToCents(value: number | string | null | undefined): number {
  let s = String(value ?? '0').trim();
  if (!s) return 0;
  const negative = s.startsWith('-');
  if (negative || s.startsWith('+')) s = s.slice(1);
  const [intPart = '0', fracRaw = ''] = s.split('.');
  const frac = (fracRaw + '000').slice(0, 3);
  let cents = parseInt(intPart || '0', 10) * 100 + parseInt(frac.slice(0, 2), 10);
  if (parseInt(frac[2], 10) >= 5) cents += 1;
  const signed = negative ? -cents : cents;
  return signed === 0 ? 0 : signed;
}

function sortDeep(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, Json> = {};
    for (const key of Object.keys(value as object).sort()) {
      out[key] = sortDeep((value as Record<string, Json>)[key]);
    }
    return out;
  }
  return value;
}

export function stableJson(raw: Json): string {
  return JSON.stringify(sortDeep(raw));
}

export function normalizeStatus(raw: Record<string, Json>): string {
  return String(pyOr(get(raw, 'status'), get(raw, 'state'), get(raw, 'type'), 'SETTLED')).toUpperCase();
}

const PENDING_STATUSES = new Set(['PENDING', 'AUTHORISED', 'AUTHORIZED', 'HELD']);

export function isPendingStatus(status: string): boolean {
  return PENDING_STATUSES.has(status.toUpperCase());
}

export function extractMerchantName(raw: Record<string, Json>): string | null {
  const merchant = get(raw, 'merchant');
  if (merchant && typeof merchant === 'object' && !Array.isArray(merchant)) {
    const m = merchant as Record<string, Json>;
    const name = pyOr(get(m, 'name'), get(m, 'clean_name'), get(m, 'display_name'));
    return pyTruthy(name) ? String(name) : null;
  }
  if (typeof merchant === 'string') return merchant;
  const fallback = pyOr(get(raw, 'merchant_name'), get(raw, 'merchantName'));
  return pyTruthy(fallback) ? String(fallback) : null;
}

export function extractNzfcc(raw: Record<string, Json>): string | null {
  const category = pyOr(get(raw, 'category'), get(raw, 'categories'));
  if (category && typeof category === 'object' && !Array.isArray(category)) {
    const c = category as Record<string, Json>;
    const code = pyOr(get(c, 'nzfcc'), get(c, 'code'));
    return pyTruthy(code) ? String(code) : null;
  }
  const nzfcc = get(raw, 'nzfcc');
  return nzfcc === undefined ? null : (nzfcc as string | null);
}

export function fromAkahuPayload(raw: Record<string, Json>): RawTransaction {
  const accountId = String(pyOr(get(raw, '_account'), get(raw, 'account'), get(raw, 'account_id'), ''));
  if (!accountId) throw new Error('Akahu transaction is missing account identifier');

  const transactionDate = String(pyOr(get(raw, 'date'), get(raw, 'created_at'), get(raw, 'posted_at'), '')).slice(0, 10);
  if (!transactionDate) throw new Error('Akahu transaction is missing transaction date');

  const description = String(pyOr(get(raw, 'description'), get(raw, 'raw_description'), get(raw, 'name'), '')).trim();
  if (!description) throw new Error('Akahu transaction is missing description');

  const idRaw = pyOr(get(raw, '_id'), get(raw, 'id'), null);
  const akahuTransactionId = pyTruthy(idRaw) ? String(idRaw) : null;

  const amountValue = Object.prototype.hasOwnProperty.call(raw, 'amount') ? raw.amount : 0;
  const amountCents = decimalToCents(amountValue as number | string);
  const merchantName = extractMerchantName(raw);
  const status = normalizeStatus(raw);

  const hashInput = akahuTransactionId
    ? `akahu:${akahuTransactionId}`
    : [accountId, transactionDate, String(amountValue), description, merchantName ?? ''].join('|');
  const idempotencyHash = createHash('sha256').update(hashInput, 'utf-8').digest('hex');

  const settlement = pyOr(get(raw, 'settlement_date'), get(raw, 'settled_at'), null);

  return {
    idempotencyHash,
    akahuTransactionId,
    accountId,
    status,
    amountCents,
    currency: String(pyOr(get(raw, 'currency'), 'NZD')).toUpperCase(),
    transactionDate,
    settlementDate: pyTruthy(settlement) ? String(settlement) : null,
    description,
    merchantName,
    nzfcc: extractNzfcc(raw),
    isPending: isPendingStatus(status),
    rawJson: stableJson(raw),
  };
}
