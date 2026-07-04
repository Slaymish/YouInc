import { createHash } from "node:crypto";

/**
 * TypeScript port of youinc_ledger.models.RawTransaction.from_akahu_payload +
 * stable_json (P2 ledger port). Proven byte-for-byte against the Python engine
 * by tests/golden/fixtures/idempotency_hash.json (see rawTransaction.golden.test.ts).
 *
 * The idempotency_hash cross-language equality is the HARD acceptance gate: it
 * feeds dedup against already-persisted rows, so ANY divergence reprocesses the
 * owner's whole history as "new". The subtle bits — Python truthiness in the
 * `or`-chains, ROUND_HALF_UP (ties away from zero) decimal→cents, and the
 * shortest-round-trip float formatting that JSON.stringify shares with Python's
 * json.dumps — are reproduced deliberately here.
 */

export type Side = "debit" | "credit";

export interface RawTransaction {
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
}

type Json = unknown;

/** Python truthiness: None/""/0/[]/{}/false are falsy; everything else truthy. */
function pyTruthy(v: Json): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.length > 0;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

/** `a or b or c ...` — first Python-truthy operand, else the last operand. */
function pyOr(...values: Json[]): Json {
  for (const v of values) {
    if (pyTruthy(v)) return v;
  }
  return values[values.length - 1];
}

function get(raw: Record<string, Json>, key: string): Json {
  return Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : undefined;
}

/**
 * Python `str(value)` for the values that reach the hash/cents paths: JSON
 * numbers, strings, ints. JS String() and Python str() agree on shortest
 * round-trip floats and on ints/strings. Integer-valued bare floats (10.0)
 * are the one documented divergence and are excluded from the corpus.
 */
function pyStr(value: Json): string {
  if (value === null || value === undefined) return String(value);
  return String(value);
}

/**
 * Port of decimal_to_cents: Decimal(str(value)).quantize(0.01, ROUND_HALF_UP)*100.
 * ROUND_HALF_UP = ties away from zero. Done on the decimal string to avoid
 * binary-float error; only the 3rd fractional digit decides rounding to 2dp.
 */
export function decimalToCents(value: number | string): number {
  let s = pyStr(value).trim();
  const negative = s.startsWith("-");
  if (negative || s.startsWith("+")) s = s.slice(1);

  const [intPart = "0", fracRaw = ""] = s.split(".");
  const frac = (fracRaw + "000").slice(0, 3);
  let cents = parseInt(intPart || "0", 10) * 100 + parseInt(frac.slice(0, 2), 10);
  if (parseInt(frac[2], 10) >= 5) cents += 1; // HALF_UP (ties away from zero)
  const signed = negative ? -cents : cents;
  // Python int has no negative zero: decimal_to_cents("-0.00") == 0, not -0.
  return signed === 0 ? 0 : signed;
}

/** Recursively sort object keys, then JSON.stringify — matches Python
 *  json.dumps(sort_keys=True, separators=(",",":"), ensure_ascii=False). */
function sortDeep(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
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
  const status = pyOr(get(raw, "status"), get(raw, "state"), get(raw, "type"), "SETTLED");
  return pyStr(status).toUpperCase();
}

const PENDING_STATUSES = new Set(["PENDING", "AUTHORISED", "AUTHORIZED", "HELD"]);

export function isPendingStatus(status: string): boolean {
  return PENDING_STATUSES.has(status.toUpperCase());
}

export function extractMerchantName(raw: Record<string, Json>): string | null {
  const merchant = get(raw, "merchant");
  if (merchant && typeof merchant === "object" && !Array.isArray(merchant)) {
    const m = merchant as Record<string, Json>;
    const name = pyOr(get(m, "name"), get(m, "clean_name"), get(m, "display_name"));
    return pyTruthy(name) ? (name as string) : null;
  }
  if (typeof merchant === "string") return merchant;
  const fallback = pyOr(get(raw, "merchant_name"), get(raw, "merchantName"));
  return pyTruthy(fallback) ? (fallback as string) : null;
}

export function extractNzfcc(raw: Record<string, Json>): string | null {
  const category = pyOr(get(raw, "category"), get(raw, "categories"));
  if (category && typeof category === "object" && !Array.isArray(category)) {
    const c = category as Record<string, Json>;
    const code = pyOr(get(c, "nzfcc"), get(c, "code"));
    return pyTruthy(code) ? (code as string) : null;
  }
  const nzfcc = get(raw, "nzfcc");
  return nzfcc === undefined ? null : (nzfcc as string | null);
}

export function fromAkahuPayload(raw: Record<string, Json>): RawTransaction {
  const accountId = pyStr(pyOr(get(raw, "_account"), get(raw, "account"), get(raw, "account_id"), ""));
  if (!accountId) {
    throw new Error("Akahu transaction is missing account identifier");
  }

  const transactionDate = pyStr(
    pyOr(get(raw, "date"), get(raw, "created_at"), get(raw, "posted_at"), ""),
  ).slice(0, 10);
  if (!transactionDate) {
    throw new Error("Akahu transaction is missing transaction date");
  }

  const description = pyStr(
    pyOr(get(raw, "description"), get(raw, "raw_description"), get(raw, "name"), ""),
  ).trim();
  if (!description) {
    throw new Error("Akahu transaction is missing description");
  }

  const idRaw = pyOr(get(raw, "_id"), get(raw, "id"), null);
  const akahuTransactionId = pyTruthy(idRaw) ? pyStr(idRaw) : null;

  const amountValue = Object.prototype.hasOwnProperty.call(raw, "amount") ? raw.amount : 0;
  const amountCents = decimalToCents(amountValue as number | string);
  const merchantName = extractMerchantName(raw);
  const status = normalizeStatus(raw);

  const hashInput = akahuTransactionId
    ? `akahu:${akahuTransactionId}`
    : [accountId, transactionDate, pyStr(amountValue), description, merchantName ?? ""].join("|");

  const idempotencyHash = createHash("sha256").update(hashInput, "utf-8").digest("hex");

  const settlement = pyOr(get(raw, "settlement_date"), get(raw, "settled_at"), null);

  return {
    idempotencyHash,
    akahuTransactionId,
    accountId,
    status,
    amountCents,
    currency: pyStr(pyOr(get(raw, "currency"), "NZD")).toUpperCase(),
    transactionDate,
    settlementDate: pyTruthy(settlement) ? (settlement as string) : null,
    description,
    merchantName,
    nzfcc: extractNzfcc(raw),
    isPending: isPendingStatus(status),
    rawJson: stableJson(raw),
  };
}
