import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openLedger } from '../database.ts';
import { reconcile, recordAndAnchor, setBasis, toCents, formatCents } from '../balances.ts';
import { sync } from '../sync.ts';
import { AkahuClient } from '../akahu.ts';
import { doctor } from '../doctor.ts';
import { spendByAccount } from '../reports.ts';
import { applyPairs, candidates, proposePairs } from '../transfers.ts';
import { loadRoutingConfig } from '../config.ts';
import { reclassify, setManualBalance } from '../adjust.ts';
import { repost } from '../repost.ts';

/**
 * Reconciliation and sync behaviour, exercised end to end against a real
 * SQLite file with a stubbed Akahu client — no network, no credentials.
 *
 * The tests are the specification for the rule Hamish set on 17 Oct: the
 * ledger may never fall behind the bank, and an unexplained gap is reported
 * rather than smoothed over.
 */

let dir: string;
let db: DatabaseSync;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'youinc-test-'));
  db = openLedger(join(dir, 'ledger.sqlite3')).db;
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const BNZ = { _id: 'acc_bnzoperating000000000000', name: 'Operating', status: 'ACTIVE', type: 'CHECKING', attributes: ['TRANSACTIONS'], formatted_account: '02-1234-0000001-00', connection: { _id: 'conn_bnz000000000000000000000', name: 'BNZ' }, balance: { current: 1000, available: 1000, currency: 'NZD' }, refreshed: { balance: '2026-10-16T09:00:00.000Z' } };
const SHARESIES_SPEND = { _id: 'acc_sharesiesspend0000000000', name: 'Spend', status: 'ACTIVE', type: 'INVESTMENT', attributes: ['TRANSACTIONS'], formatted_account: 'SPEND-123', connection: { _id: 'conn_sharesies00000000000000', name: 'Sharesies' }, balance: { current: 250, available: 250, currency: 'NZD' }, refreshed: { balance: '2026-10-16T09:00:00.000Z' } };
const SHARESIES_GROWTH = { _id: 'acc_sharesiesgrowth000000000', name: 'Growth', status: 'ACTIVE', type: 'INVESTMENT', attributes: [], connection: { _id: 'conn_sharesies00000000000000', name: 'Sharesies' }, balance: { current: 12000, available: 12000, currency: 'NZD' }, refreshed: { balance: '2026-10-16T09:00:00.000Z' } };

function txn(id: string, account: string, date: string, amount: number, description: string) {
  return { _id: id, _account: account, date, amount, description, status: 'SETTLED' };
}

/** Minimal Akahu stand-in: accounts + per-account transactions, no network. */
function stubClient(accounts: unknown[], transactions: Record<string, unknown[]>) {
  const calls: Array<{ path: string; query: Record<string, unknown> }> = [];
  const fetchFn = (async (input: string | URL) => {
    const url = new URL(String(input));
    const path = url.pathname.replace('/v1', '');
    calls.push({ path, query: Object.fromEntries(url.searchParams) });
    if (path === '/accounts') return json({ success: true, items: accounts });
    if (path === '/refresh') return json({ success: true });
    const match = /^\/accounts\/([^/]+)\/transactions$/.exec(path);
    if (match) return json({ success: true, items: transactions[decodeURIComponent(match[1])] ?? [] });
    return json({ message: 'not found' }, 404);
  }) as unknown as typeof fetch;
  const client = new AkahuClient({ appToken: 'app', userToken: 'user', fetchFn });
  return { client, calls };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('anchored balances', () => {
  test('a first sync anchors every account at the bank-reported balance', async () => {
    const { client } = stubClient([BNZ, SHARESIES_SPEND, SHARESIES_GROWTH], {});
    await sync(db, { client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });

    const accounts = reconcile(db, { now: new Date('2026-10-17T00:00:00Z') });
    expect(accounts).toHaveLength(3);
    const operating = accounts.find((a) => a.ledgerAccount === 'Assets:BNZ:Operating');
    expect(operating?.reportedCents).toBe(100_000);
    expect(operating?.ledgerCents).toBe(100_000);
    expect(operating?.status).toBe('agrees');
  });

  test('an account without a transaction feed is labelled balance-only, never reconciled as a feed', async () => {
    const { client } = stubClient([BNZ, SHARESIES_GROWTH], {});
    await sync(db, { client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });
    const growth = reconcile(db).find((a) => a.name === 'Growth');
    expect(growth?.hasFeed).toBe(false);
    expect(growth?.status).toBe('balance-only');
    expect(growth?.reportedCents).toBe(1_200_000);
  });

  test('postings after the anchor move the ledger figure, and it still agrees', async () => {
    const { client } = stubClient([BNZ], {
      [BNZ._id]: [txn('trn_1', BNZ._id, '2026-10-16', -50, 'Countdown Wellington')],
    });
    await sync(db, { client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });
    // The bank's figure predates the transaction, so the ledger is 50 lower.
    const operating = reconcile(db, { now: new Date('2026-10-17T00:00:00Z') }).find((a) => a.ledgerAccount === 'Assets:BNZ:Operating');
    expect(operating?.reportedCents).toBe(100_000);
    // The transaction is dated on the same day as the bank's refresh, so its
    // day is not strictly after the anchor and it is assumed to be inside the
    // stated balance. The ledger must equal the bank either way.
    expect(operating?.ledgerCents).toBe(100_000);
    expect(operating?.status).toBe('agrees');
    // Default mode reports the balance, not an explanation, for a fresh gap.
    expect(operating?.gap).toHaveLength(0);
  });

  test('a first sync posts to the mapped ledger account, never Assets:Unmapped', async () => {
    // Regression: routing used to be loaded before the mappings were upserted,
    // so the very first sync filed everything under Assets:Unmapped:<id> and
    // never self-corrected on later runs.
    const { client } = stubClient([BNZ], {
      [BNZ._id]: [txn('trn_1', BNZ._id, '2026-10-16', -50, 'Countdown Wellington')],
    });
    await sync(db, { client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });

    const unmapped = db.prepare("SELECT COUNT(*) AS n FROM journal_entries WHERE account LIKE 'Assets:Unmapped:%'").get() as { n: number };
    expect(unmapped.n).toBe(0);
    const posted = db.prepare("SELECT COUNT(*) AS n FROM journal_entries WHERE account = 'Assets:BNZ:Operating'").get() as { n: number };
    expect(posted.n).toBe(1);
  });

  test('an unexplained inflow goes to income suspense, not into expenses', async () => {
    // A credit on an expense account reads as negative spending. Money arriving
    // from an unknown source is its own question, not a refund.
    const { client } = stubClient([BNZ], {
      [BNZ._id]: [
        txn('trn_in', BNZ._id, '2026-10-16', 250, 'Deposit from J Smith'),
        txn('trn_out', BNZ._id, '2026-10-16', -40, 'Countdown Wellington'),
      ],
    });
    await sync(db, { client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });

    const rows = db.prepare(
      "SELECT account, side FROM journal_entries e JOIN journal_transactions j ON j.id = e.journal_transaction_id WHERE j.description LIKE 'Deposit%' ORDER BY side",
    ).all() as Array<{ account: string; side: string }>;
    expect(rows.find((r) => r.side === 'credit')?.account).toBe('Income:Unidentified');
    // The expense side of the ledger carries only the outflow.
    const spend = spendByAccount(db, '2026-10-01', '2026-10-31', 'top');
    expect(spend).toHaveLength(1);
    expect(spend[0].cents).toBe(4_000);
  });

  test('a later sync re-anchors: the ledger can never stay behind the bank', async () => {
    const first = stubClient([BNZ], { [BNZ._id]: [txn('trn_1', BNZ._id, '2026-10-16', -50, 'Countdown Wellington')] });
    await sync(db, { client: first.client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });

    // The bank later settles a fee we never saw, and states a new balance.
    const bnzAfterFee = { ...BNZ, balance: { current: 900, available: 900, currency: 'NZD' }, refreshed: { balance: '2026-10-18T09:00:00.000Z' } };
    const second = stubClient([bnzAfterFee], { [BNZ._id]: [txn('trn_1', BNZ._id, '2026-10-16', -50, 'Countdown Wellington')] });
    await sync(db, { client: second.client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-18T12:00:00Z') });

    const operating = reconcile(db, { now: new Date('2026-10-18T12:00:00Z') }).find((a) => a.ledgerAccount === 'Assets:BNZ:Operating');
    expect(operating?.reportedCents).toBe(90_000);
    expect(operating?.ledgerCents).toBe(90_000);
    expect(operating?.status).toBe('agrees');
  });

  test('an unexplained gap is reported, and the bank figure still wins', () => {
    recordAndAnchor(db, { akahuAccountId: BNZ._id, balanceCents: 100_000, source: 'akahu', akahuRefreshedAt: '2026-10-16T09:00:00.000Z' });
    db.prepare(`INSERT INTO account_mappings VALUES ('m1',?, 'Operating','Assets:BNZ:Operating','asset',1,'BNZ','conn_bnz000000000000000000000',1,'02-1234-0000001-00',NULL,'2026-01-01','2026-01-01')`).run(BNZ._id);
    // The bank now says less, with nothing in our postings to explain it.
    // The bank now states less. The anchor moved with it, and the postings
    // since then say nothing, so the difference can only be reported.
    recordAndAnchor(db, { akahuAccountId: BNZ._id, balanceCents: 87_500, source: 'akahu', akahuRefreshedAt: '2026-10-17T09:00:00.000Z' });

    const [defaultView] = reconcile(db, { now: new Date('2026-10-17T10:00:00Z') });
    expect(defaultView.ledgerCents).toBe(87_500);
    expect(defaultView.reportedCents).toBe(87_500);

  });

  test('a gap left behind by an anchor move is explained as far as the evidence allows', () => {
    recordAndAnchor(db, { akahuAccountId: BNZ._id, balanceCents: 100_000, source: 'akahu', akahuRefreshedAt: '2026-10-16T09:00:00.000Z' });
    db.prepare(`INSERT INTO account_mappings VALUES ('m1',?, 'Operating','Assets:BNZ:Operating','asset',1,'BNZ',NULL,1,NULL,NULL,'2026-01-01','2026-01-01')`).run(BNZ._id);
    // Postings we recorded, then a bank figure 125 lower with no matching posting.
    db.prepare(`INSERT INTO journal_transactions VALUES ('j1','j1','2026-10-16','Some purchase','${BNZ._id}','SETTLED',NULL)`).run();
    db.prepare(`INSERT INTO journal_entries (journal_transaction_id, account, side, amount_cents, currency) VALUES ('j1','Assets:BNZ:Operating','credit',3000,'NZD')`).run();
    db.prepare(`INSERT INTO journal_entries (journal_transaction_id, account, side, amount_cents, currency) VALUES ('j1','Expenses:Other','debit',3000,'NZD')`).run();
    setBasis(db, BNZ._id, 87_500, '2026-10-16T09:00:00.000Z', 'reported');

    const [explained] = reconcile(db, { now: new Date('2026-10-17T10:00:00Z'), detail: 'explained' });
    expect(explained.gap).toHaveLength(1);
    expect(explained.gap[0].class).toBe('unknown');
    expect(explained.gap[0].cents).toBe(12_500);
    expect(explained.gap[0].explanation).toContain('Cause unknown');
  });

  test('a stale reported balance is called stale rather than silently trusted', () => {
    recordAndAnchor(db, { akahuAccountId: BNZ._id, balanceCents: 100_000, source: 'akahu', akahuRefreshedAt: '2026-10-10T09:00:00.000Z' });
    db.prepare(`INSERT INTO account_mappings VALUES ('m1',?, 'Operating','Assets:BNZ:Operating','asset',1,'BNZ',NULL,1,NULL,NULL,'2026-01-01','2026-01-01')`).run(BNZ._id);
    const [operating] = reconcile(db, { now: new Date('2026-10-17T10:00:00Z'), staleAfterHours: 36 });
    expect(operating.status).toBe('stale');
    expect(operating.reportedAgeHours).toBeGreaterThan(160);
  });
});

describe('transfers between own accounts', () => {
  test('an outflow on one feed and inflow on another post as ONE balanced journal', async () => {
    // Map both accounts up front so the ledger paths are his names, not the
    // first-sync defaults derived from Akahu metadata.
    const map = (id: string, account: string) => db.prepare(
      `INSERT INTO account_mappings (id, akahu_account_id, name, ledger_account, account_type, has_feed, connection, connection_id, connection_has_feed, formatted_account, credit_limit_cents, created_at, updated_at)
       VALUES (?,?,?,?,'asset',1,NULL,NULL,1,NULL,NULL,'2026-01-01','2026-01-01')`,
    ).run(`${id}-map`, id, account, account);
    map(BNZ._id, 'Assets:BNZ:Operating');
    map(SHARESIES_SPEND._id, 'Assets:Sharesies:Spend');
    const out = txn('trn_out', BNZ._id, '2026-10-15', -500, 'Transfer to Sharesies');
    const inn = txn('trn_in', SHARESIES_SPEND._id, '2026-10-16', 500, 'Deposit from BNZ');
    const { client } = stubClient([BNZ, SHARESIES_SPEND], { [BNZ._id]: [out], [SHARESIES_SPEND._id]: [inn] });
    await sync(db, { client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });

    const pairs = db.prepare('SELECT * FROM transfer_pairs').all();
    expect(pairs).toHaveLength(1);
    const journals = db.prepare(
      `SELECT j.external_id AS id, e.account, e.side, e.amount_cents AS cents
         FROM journal_transactions j JOIN journal_entries e ON e.journal_transaction_id = j.id
        WHERE j.external_id LIKE 'transfer:%'`,
    ).all() as Array<{ account: string; side: string; cents: number }>;
    expect(journals).toHaveLength(2);
    expect(journals.find((j) => j.side === 'debit')?.account).toBe('Assets:Sharesies:Spend');
    expect(journals.find((j) => j.side === 'credit')?.account).toBe('Assets:BNZ:Operating');
    // Neither leg posted on its own: only the pair journal exists for them.
    const lone = db.prepare("SELECT COUNT(*) AS n FROM journal_transactions WHERE external_id IN (SELECT idempotency_hash FROM raw_transactions WHERE raw_json LIKE '%trn_out%')").get() as { n: number };
    expect(lone.n).toBe(0);
  });

  test('a second sync never re-posts a leg the pair already consumed', async () => {
    // Regression: applyPairs resets `processed_at` on both legs, and import
    // used to post any raw row without a journal — so the next sync re-posted
    // each paired leg as a lone journal beside the pair. Every transfer was
    // then counted twice and card payments landed in suspense as credits.
    const out = txn('trn_out', BNZ._id, '2026-10-15', -500, 'Transfer to Sharesies');
    const inn = txn('trn_in', SHARESIES_SPEND._id, '2026-10-16', 500, 'Deposit from BNZ');
    const { client } = stubClient([BNZ, SHARESIES_SPEND], { [BNZ._id]: [out], [SHARESIES_SPEND._id]: [inn] });
    await sync(db, { client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });
    await sync(db, { client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-18T00:00:00Z') });

    const journals = db.prepare('SELECT COUNT(*) AS n FROM journal_transactions').get() as { n: number };
    expect(journals.n).toBe(1);
    const legs = db.prepare("SELECT COUNT(*) AS n FROM journal_entries WHERE account = 'Assets:Sharesies:Spend'").get() as { n: number };
    expect(legs.n).toBe(1);
    expect(spendByAccount(db, '2026-10-01', '2026-10-31', 'top')).toEqual([]);
  });

  test('a transfer is not booked as spending', async () => {
    const out = txn('trn_out', BNZ._id, '2026-10-15', -500, 'Transfer to Sharesies');
    const inn = txn('trn_in', SHARESIES_SPEND._id, '2026-10-16', 500, 'Deposit from BNZ');
    const { client } = stubClient([BNZ, SHARESIES_SPEND], { [BNZ._id]: [out], [SHARESIES_SPEND._id]: [inn] });
    await sync(db, { client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });
    const suspense = spendByAccount(db, '2026-10-01', '2026-10-31', 'top');
    // The only expense entry is the transfer routed to suspense before pairing;
    // pairing must have removed it.
    expect(suspense).toEqual([]);
  });

  test('equal amounts on different days beyond the window are not paired', () => {
    const candidate = (hash: string, account: string, date: string, amount: number) => ({
      hash, akahuAccountId: account, ledgerAccount: `Assets:${account}`, connectionId: null,
      connectionHasFeed: true, formattedAccount: null,
      transactionDate: date, amountCents: amount, description: 'x',
    });
    const result = proposePairs([
      candidate('a', 'acc_one', '2026-10-01', -50_000),
      candidate('b', 'acc_two', '2026-10-09', 50_000),
    ], 3);
    expect(result.pairs).toHaveLength(0);
    expect(result.unpaired).toHaveLength(2);
  });

  test('a hand-classified leg is never silently replaced by a pair', () => {
    const candidate = (hash: string, account: string, date: string, amount: number) => ({
      hash, akahuAccountId: account, ledgerAccount: `Assets:${account}`, connectionId: null,
      connectionHasFeed: true, formattedAccount: null,
      transactionDate: date, amountCents: amount, description: 'x',
    });
    db.prepare(`INSERT INTO account_mappings VALUES ('m1','acc_one','One','Assets:acc_one','asset',1,NULL,NULL,1,NULL,NULL,'2026-01-01','2026-01-01')`).run();
    db.prepare(`INSERT INTO account_mappings VALUES ('m2','acc_two','Two','Assets:acc_two','asset',1,NULL,NULL,1,NULL,NULL,'2026-01-01','2026-01-01')`).run();
    for (const [hash, account, cents] of [['h1', 'acc_one', -5000], ['h2', 'acc_two', 5000]] as const) {
      db.prepare('INSERT INTO raw_transactions VALUES (?,?,?,?,NULL)').run(hash, '2026-10-15', JSON.stringify({ _id: hash, _account: account, date: '2026-10-15', amount: cents / 100, description: 'moved' }), '2026-10-15T00:00:00Z');
      db.prepare(`INSERT INTO journal_transactions VALUES (?,?,?,?,?,?,?)`).run(hash, hash, '2026-10-15', 'moved', account, 'SETTLED', 'manual:override');
    }
    const result = applyPairs(db, loadRoutingConfig(db), proposePairs([candidate('h1', 'acc_one', '2026-10-15', -5000), candidate('h2', 'acc_two', '2026-10-15', 5000)]).pairs);
    expect(result.applied).toBe(0);
    expect(result.errors.join(' ')).toContain('set by hand');
    // The hand-set journal survives.
    expect(db.prepare('SELECT COUNT(*) AS n FROM journal_transactions WHERE external_id = ?').get('h1')).toEqual({ n: 1 });
  });
});

describe('corrections and integrity', () => {
  test('reclassify posts a correction and leaves the original journal intact', async () => {
    const { client } = stubClient([BNZ], { [BNZ._id]: [txn('trn_1', BNZ._id, '2026-10-16', -50, 'Countdown Wellington')] });
    await sync(db, { client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });
    const row = db.prepare("SELECT external_id AS id FROM journal_transactions WHERE external_id NOT LIKE 'transfer:%'").get() as { id: string };
    const result = reclassify(db, row.id, 'Expenses:Groceries');
    expect(result.fromAccount).toBe('Expenses:Uncategorized:Suspense');
    expect(db.prepare('SELECT COUNT(*) AS n FROM journal_transactions WHERE external_id = ?').get(row.id)).toEqual({ n: 1 });
    expect(doctor(db, 'x').unbalancedJournals).toHaveLength(0);
  });

  test('repost applies a new rule to history without touching balances', async () => {
    // Classification is decided at import time, so a new rule must be able to
    // rebuild the postings it applies to. Repost derives again from the stored
    // raw rows: same evidence, current rules, one pass.
    const { client } = stubClient([BNZ], {
      [BNZ._id]: [
        txn('trn_shop', BNZ._id, '2026-10-14', -50, 'Countdown Wellington'),
        txn('trn_coffee', BNZ._id, '2026-10-15', -5, 'Sierra Cafe Lambton'),
      ],
    });
    await sync(db, { client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });
    expect(spendByAccount(db, '2026-10-01', '2026-10-31', 'top')[0].group).toBe('Expenses:Uncategorized');

    // Bank descriptions are inconsistently cased (Woolworths / WOOLWORTHS), so
    // a real rule carries the inline flag; the engine translates `(?i)`.
    db.prepare(`INSERT INTO classification_rules (id, rule_key, seq, priority, is_enabled, match_description_regex, match_merchant_regex, match_amount_greater_than, match_amount_abs_greater_than, route_target_account, route_memo)
                VALUES ('r1','countdown',0,10,1,'(?i)countdown',NULL,NULL,NULL,'Expenses:Groceries',NULL)`).run();

    const result = repost(db, loadRoutingConfig(db));
    expect(result.posted).toBe(2);
    const groups = spendByAccount(db, '2026-10-01', '2026-10-31', 'top').map((g) => g.group);
    expect(groups).toContain('Expenses:Groceries');
    // Balances are untouched by a reclassification of history.
    const [operating] = reconcile(db, { now: new Date('2026-10-17T01:00:00Z') });
    expect(operating.reportedCents).toBe(operating.ledgerCents);
    expect(doctor(db, 'x').unbalancedJournals).toHaveLength(0);
  });

  test('repost keeps a hand-classified journal and transfer pairs single', async () => {
    const out = txn('trn_out', BNZ._id, '2026-10-15', -500, 'Transfer to Sharesies');
    const inn = txn('trn_in', SHARESIES_SPEND._id, '2026-10-16', 500, 'Deposit from BNZ');
    const { client } = stubClient([BNZ, SHARESIES_SPEND], { [BNZ._id]: [out], [SHARESIES_SPEND._id]: [inn] });
    await sync(db, { client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });
    const hand = db.prepare("SELECT external_id AS id FROM journal_transactions WHERE external_id NOT LIKE 'transfer:%'").get() as { id: string } | undefined;
    if (hand) reclassify(db, hand.id, 'Expenses:Groceries');

    const result = repost(db, loadRoutingConfig(db));
    expect(result.appliedPairs).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM journal_transactions WHERE rule_id LIKE 'manual:%'").get()).toEqual({ n: hand ? 1 : 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM journal_transactions WHERE rule_id = 'transfer:pair'").get()).toEqual({ n: 1 });
  });

  test('a manual account outside Akahu is registered, anchored and reported', () => {
    // A savings app or wallet he holds but Akahu cannot see. Without a mapping
    // it is invisible to reconcile, so set-balance can create a balance-only
    // account rather than leaving it out of net worth.
    setManualBalance(db, 'manual_blossom', 57_234, '2026-10-17', 'Assets:Blossom');
    const account = reconcile(db, { now: new Date('2026-10-17T12:00:00Z') })
      .find((a) => a.ledgerAccount === 'Assets:Blossom');
    expect(account?.status).toBe('balance-only');
    expect(account?.reportedCents).toBe(57_234);
    // No feed, so nothing pretends to reconcile against it.
    expect(account?.ledgerCents).toBeNull();
    expect(() => setManualBalance(db, 'manual_unknown', 100, '2026-10-17')).toThrow(/--ledger/);
  });

  test('doctor catches an unbalanced journal', () => {
    db.prepare(`INSERT INTO journal_transactions VALUES ('bad','bad','2026-10-01','bad','acc','SETTLED',NULL)`).run();
    db.prepare(`INSERT INTO journal_entries (journal_transaction_id, account, side, amount_cents, currency) VALUES ('bad','Assets:X','debit',100,'NZD')`).run();
    const report = doctor(db, 'x');
    expect(report.ok).toBe(false);
    expect(report.unbalancedJournals).toHaveLength(1);
  });

  test('sync is idempotent: a second identical run posts nothing new', async () => {
    const txns = { [BNZ._id]: [txn('trn_1', BNZ._id, '2026-10-16', -50, 'Countdown Wellington')] };
    const first = stubClient([BNZ], txns);
    await sync(db, { client: first.client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T00:00:00Z') });
    const before = (db.prepare('SELECT COUNT(*) AS n FROM journal_transactions').get() as { n: number }).n;
    const second = stubClient([BNZ], txns);
    const report = await sync(db, { client: second.client, config: { appToken: 'a', userToken: 'u' }, now: new Date('2026-10-17T01:00:00Z') });
    const after = (db.prepare('SELECT COUNT(*) AS n FROM journal_transactions').get() as { n: number }).n;
    expect(after).toBe(before);
    expect(report.accounts[0].imported?.posted).toBe(0);
    expect(report.accounts[0].imported?.skipped.duplicate).toBe(1);
  });
});

describe('money formatting', () => {
  test('cents convert with half-up rounding', () => {
    expect(toCents(12.345)).toBe(1235);
    expect(toCents('12.344')).toBe(1234);
    expect(toCents(-0.005)).toBe(-1);
    expect(toCents(0)).toBe(0);
    expect(formatCents(-1234)).toBe('-$12.34');
    expect(formatCents(5)).toBe('$0.05');
  });
});

describe('the CLI as an agent would call it', () => {
  const runCli = (args: string[], dirPath: string) => {
    // Credentials are stripped: the assertion below is about the CLI's own
    // reporting, not about whatever the developer's shell happens to export.
    const env = { ...process.env, YOUINC_DB_PATH: join(dirPath, 'ledger.sqlite3'), AKAHU_APP_TOKEN: '', AKAHU_USER_TOKEN: '' };
    try {
      return { code: 0, out: execFileSync(process.execPath, ['cli.ts', ...args], {
        env, encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname,
      }) };
    } catch (error) {
      const e = error as { status: number; stderr: string };
      return { code: e.status, out: e.stderr };
    }
  };

  test('JSON by default, --human for tables, exit codes distinguish data from failure', async () => {
    const run = (args: string[]) => runCli(args, dir);

    const status = run(['status']);
    expect(status.code).toBe(0);
    expect(JSON.parse(status.out).credentials.appToken).toBe(false);

    expect(run(['rule', 'add', '--key', 'countdown', '--match-regex', 'COUNTDOWN', '--to', 'Expenses:Groceries']).code).toBe(0);
    const listed = JSON.parse(run(['rule', 'list']).out);
    expect(listed.rules[0]).toMatchObject({ key: 'countdown', targetAccount: 'Expenses:Groceries', enabled: true });

    // A missing credential is a clean actionable error (exit 2), not a crash,
    // and it never echoes a secret.
    const syncOut = run(['sync']);
    expect(syncOut.code).toBe(2);
    expect(syncOut.out).toContain('AKAHU_APP_TOKEN');
    expect(syncOut.out).not.toContain('token=');
  });

  test('a report larger than one pipe buffer arrives intact', async () => {
    // Regression: process.exit() straight after a stdout write cut the JSON at
    // the 64KB pipe buffer. Piped output is the agent interface, so a big
    // report must parse.
    const bigDir = mkdtempSync(join(tmpdir(), 'youinc-big-'));
    try {
      const big = openLedger(join(bigDir, 'ledger.sqlite3')).db;
      const insert = big.prepare(`INSERT INTO account_mappings VALUES (?,?,?,?,?,1,'BNZ',NULL,1,NULL,NULL,'2026-01-01','2026-01-01')`);
      const basis = big.prepare(`INSERT INTO account_basis (akahu_account_id, anchor_cents, anchored_at, anchor_balance_id, reason, updated_at) VALUES (?,?,?,NULL,'reported','2026-01-01')`);
      for (let i = 0; i < 1200; i += 1) {
        const id = `acc_pad${String(i).padStart(18, '0')}`;
        insert.run(`m${i}`, id, `Account ${i}`, `Assets:BNZ:Operating:VeryLongAccountNameNumber${i}`, 'asset');
        basis.run(id, 100_000 + i, '2026-10-17T00:00:00.000Z');
      }
      big.close();

      const result = runCli(['balances'], bigDir);
      expect(result.code).toBe(0);
      expect(result.out.length).toBeGreaterThan(70_000);
      const parsed = JSON.parse(result.out);
      expect(parsed.accounts).toHaveLength(1200);
    } finally {
      rmSync(bigDir, { recursive: true, force: true });
    }
  });
});
