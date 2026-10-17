import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePolicy, decide, PurchaseLedger, categoryAllowed, toCents, type PurchaseRequest } from './authority.ts';

/**
 * The standing spending authority's contract.
 *
 * These tests are the promise made to Hamish: a limit that cannot be exceeded,
 * no path from "I am trusted" to "I can spend anything", and an audit trail
 * that survives a crash mid-purchase.
 */

const here = dirname(fileURLToPath(import.meta.url));

const UNATTENDED = `
currency: NZD
mode: unattended
per_purchase_limit: 50
per_call_limit: 50
monthly_limit: 150
require_approval_above: 25
allowlist:
  - Software
  - Books
denylist:
  - temu.com
`;

function req(over: Partial<PurchaseRequest> = {}): PurchaseRequest {
  return {
    purpose: 'a tool that helps',
    merchant: 'example.com',
    amountCents: 1200,
    category: 'Software',
    at: '2026-10-17T03:00:00.000Z',
    ...over,
  };
}

describe('policy parsing', () => {
  test('the shipped example is notify-only and refuses to be read as unattended', () => {
    const policy = parsePolicy(readFileSync(join(here, 'policy.yaml.example'), 'utf8'));
    expect(policy.mode).toBe('notify');
    expect(decide(policy, req(), 0).decision).toBe('blocked');
  });

  test('unattended with no limit is a configuration error, not a free card', () => {
    expect(() => parsePolicy('mode: unattended\nper_purchase_limit: 0\nallowlist:\n  - Software\n')).toThrow(/per_purchase_limit/);
  });

  test('unattended with an empty allowlist is refused', () => {
    expect(() => parsePolicy('mode: unattended\nper_purchase_limit: 50\n')).toThrow(/allowlist/);
  });

  test('a category allowlist entry covers its children', () => {
    expect(categoryAllowed(['Software'], 'Software:Subscriptions')).toBe(true);
    expect(categoryAllowed(['Software'], 'Softwareish')).toBe(false);
  });
});

describe('decisions', () => {
  const policy = parsePolicy(UNATTENDED);

  test('a small in-category purchase is allowed unattended', () => {
    expect(decide(policy, req(), 0)).toMatchObject({ decision: 'allow' });
  });

  test('above the per-purchase limit is refused', () => {
    const result = decide(policy, req({ amountCents: 5001 }), 0);
    expect(result.decision).toBe('blocked');
    expect(result.reason).toMatch(/per-purchase/);
  });

  test('the monthly sum is enforced, not just the single purchase', () => {
    // 12 x $10 = $120 already spent; one more $10 stays inside $150.
    expect(decide(policy, req({ amountCents: 1000 }), 12000).decision).toBe('allow');
    // $45 more would be $165 > $150.
    const result = decide(policy, req({ amountCents: 4500 }), 12000);
    expect(result.decision).toBe('blocked');
    expect(result.reason).toMatch(/monthly limit/);
  });

  test('the approval threshold asks instead of deciding', () => {
    expect(decide(policy, req({ amountCents: 2500 }), 0).decision).toBe('needs_approval');
    expect(decide(policy, req({ amountCents: 2400 }), 0).decision).toBe('allow');
  });

  test('outside the allowlist needs a human', () => {
    const result = decide(policy, req({ category: 'Clothing' }), 0);
    expect(result.decision).toBe('blocked');
    expect(result.reason).toMatch(/allowlist/);
  });

  test('hard-blocked categories cannot be bought even if he allows them', () => {
    const withGambling = parsePolicy(`${UNATTENDED.replace('  - Books', '  - Books\n  - Gambling')}`);
    const result = decide(withGambling, req({ category: 'Gambling', amountCents: 100 }), 0);
    expect(result.decision).toBe('blocked');
    expect(result.reason).toMatch(/hard-blocked/);
  });

  test('crypto and cash advances are hard-blocked by default', () => {
    for (const category of ['Crypto', 'CashAdvance', 'Loans']) {
      const looselyAllowed = parsePolicy(`${UNATTENDED.replace('  - Books', `  - Books\n  - ${category}`)}`);
      expect(decide(looselyAllowed, req({ category }), 0).decision).toBe('blocked');
    }
  });

  test('a denied merchant is refused whatever the category', () => {
    const result = decide(policy, req({ merchant: 'TEMU.COM' }), 0);
    expect(result.decision).toBe('blocked');
    expect(result.reason).toMatch(/denylist/);
  });

  test('anything that creates a commitment needs a human', () => {
    const result = decide(policy, req({ createsCommitment: true, amountCents: 100 }), 0);
    expect(result.decision).toBe('blocked');
    expect(result.reason).toMatch(/commitment/);
  });

  test('a zero or negative amount is a bug, not a free purchase', () => {
    expect(decide(policy, req({ amountCents: 0 }), 0).decision).toBe('blocked');
    expect(decide(policy, req({ amountCents: -500 }), 0).decision).toBe('blocked');
  });

  test('notify mode never buys, even a $1 category-allowed purchase', () => {
    const notify = parsePolicy(UNATTENDED.replace('mode: unattended', 'mode: notify'));
    expect(decide(notify, req({ amountCents: 100 }), 0).decision).toBe('blocked');
  });
});

describe('purchase ledger', () => {
  let dir: string;
  let ledger: PurchaseLedger;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'authority-test-'));
    ledger = new PurchaseLedger(join(dir, 'purchases.sqlite3'));
  });

  afterEach(() => {
    ledger.close();
    rmSync(dir, { recursive: true, force: true });
  });

  test('an intent is recorded before money moves, and a retry cannot double-buy', () => {
    const intent = { id: 'i1', at: '2026-10-17T03:00:00.000Z', purpose: 'tool', merchant: 'x.com', amountCents: 1000, category: 'Software', decision: 'allow' as const, reason: 'ok', currency: 'NZD' };
    expect(ledger.recordIntent(intent)).toEqual({ id: 'i1', existing: false });
    expect(ledger.recordIntent({ ...intent, id: 'i2' })).toEqual({ id: 'i1', existing: true });
    expect(ledger.history()).toHaveLength(1);
  });

  test('money possibly in flight counts against the monthly limit', () => {
    ledger.recordIntent({ id: 'i1', at: '2026-10-17T03:00:00.000Z', purpose: 'tool', merchant: 'x.com', amountCents: 1000, category: 'Software', decision: 'allow', reason: 'ok', currency: 'NZD' });
    expect(ledger.spentThisMonthCents('2026-10')).toBe(1000);
    expect(ledger.unresolved()).toHaveLength(1);

    ledger.recordOutcome({ intentId: 'i1', status: 'succeeded', externalRef: 'ch_123', at: '2026-10-17T03:01:00.000Z', note: null });
    expect(ledger.spentThisMonthCents('2026-10')).toBe(1000);
    expect(ledger.unresolved()).toHaveLength(0);
  });

  test('a failed purchase does not consume the limit', () => {
    ledger.recordIntent({ id: 'i1', at: '2026-10-17T03:00:00.000Z', purpose: 'tool', merchant: 'x.com', amountCents: 1000, category: 'Software', decision: 'allow', reason: 'ok', currency: 'NZD' });
    ledger.recordOutcome({ intentId: 'i1', status: 'failed', externalRef: null, at: '2026-10-17T03:01:00.000Z', note: 'card declined' });
    expect(ledger.spentThisMonthCents('2026-10')).toBe(0);
  });

  test('a refused purchase never counts as spend', () => {
    ledger.recordIntent({ id: 'i1', at: '2026-10-17T03:00:00.000Z', purpose: 'gamble', merchant: 'casino', amountCents: 5000, category: 'Gambling', decision: 'blocked', reason: 'hard-blocked', currency: 'NZD' });
    expect(ledger.spentThisMonthCents('2026-10')).toBe(0);
    expect(ledger.history()[0]).toMatchObject({ decision: 'blocked', status: null });
  });
});

describe('money', () => {
  test('cents parse with half-up rounding', () => {
    expect(toCents('50')).toBe(5000);
    expect(toCents('12.345')).toBe(1235);
    expect(toCents(0)).toBe(0);
  });
});
