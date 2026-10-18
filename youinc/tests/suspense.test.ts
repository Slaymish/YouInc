import { test, describe, beforeEach, afterEach, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openLedger } from '../database.ts';
import { postJournal } from '../import.ts';
import { posting } from '../journal.ts';
import { reclassify } from '../adjust.ts';
import { suspenseQueue } from '../reports.ts';
import { doctor } from '../doctor.ts';

/**
 * Suspense is a net figure. A reclassify leaves the original suspense leg in
 * place and offsets it with a second journal, so the queue and the doctor must
 * count the residue, not the raw debits — otherwise a classified payment keeps
 * being reported as undecided, and the daily brief asks about it again.
 */

let dir: string;
let ledgerPath: string;
let db: DatabaseSync;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'youinc-suspense-'));
  ledgerPath = join(dir, 'ledger.sqlite3');
  db = openLedger(ledgerPath).db;
  // reclassify refuses to guess which leg to correct without a mapping, and
  // rightly so — a missing mapping used to reverse the bank leg instead.
  mapAccount('acc_slush', 'Assets:BNZ:slushfind');
  mapAccount('acc_cheque', 'Assets:BNZ:Cheque');
});

function mapAccount(akahuAccountId: string, ledgerAccount: string) {
  const now = '2026-10-15T00:00:00Z';
  db.prepare(
    `INSERT INTO account_mappings
       (id, akahu_account_id, name, ledger_account, account_type, has_feed, connection, connection_id,
        connection_has_feed, formatted_account, credit_limit_cents, created_at, updated_at)
     VALUES (?,?,?,?, 'asset', 1, 'test', NULL, 1, NULL, NULL, ?, ?)`,
  ).run(akahuAccountId, akahuAccountId, ledgerAccount, ledgerAccount, now, now);
}

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function postOutflow(externalId: string, date: string, description: string, cents: number) {
  const inserted = postJournal(db, {
    externalId,
    transactionDate: date,
    description,
    sourceAccountId: 'acc_slush',
    status: 'PAYMENT',
    ruleId: null,
    postings: [posting('Expenses:Uncategorized:Suspense', 'debit', cents), posting('Assets:BNZ:slushfind', 'credit', cents)],
  });
  expect(inserted).toBe(true);
}

describe('suspense queue', () => {
  test('lists an unclassified payment with no decision behind it', () => {
    postOutflow('ext-unknown', '2026-10-15', 'SOMETHING UNCLEAR', 1234);
    const queue = suspenseQueue(db);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      externalId: 'ext-unknown',
      description: 'SOMETHING UNCLEAR',
      cents: 1234,
      account: 'Expenses:Uncategorized:Suspense',
    });
  });

  test('drops a payment once it is reclassified, and keeps the audit trail', () => {
    postOutflow('ext-will-67', '2026-10-15', 'Will Hadfield 67 hahahah', 6700);

    expect(suspenseQueue(db)).toHaveLength(1);
    reclassify(db, 'ext-will-67', 'Expenses:Groceries');

    // Cleared: nothing left for a human to decide.
    expect(suspenseQueue(db)).toHaveLength(0);
    expect(doctor(db, ledgerPath).suspenseCount).toBe(0);

    // But both journals survive: the original posting is never rewritten.
    const journals = db.prepare('SELECT COUNT(*) AS n FROM journal_transactions').get() as { n: number };
    expect(Number(journals.n)).toBe(2);

    // And the suspense account nets to zero rather than carrying the amount.
    const residue = db
      .prepare(
        `SELECT SUM(CASE side WHEN 'debit' THEN amount_cents ELSE -amount_cents END) AS cents
           FROM journal_entries WHERE account = 'Expenses:Uncategorized:Suspense'`,
      )
      .get() as { cents: number };
    expect(Number(residue.cents)).toBe(0);
  });

  test('a reclassified item does not hide an unrelated one', () => {
    postOutflow('ext-a', '2026-10-15', 'Will Hadfield 67 hahahah', 6700);
    postOutflow('ext-b', '2026-10-16', 'HADFIELD, W F', 16200);
    reclassify(db, 'ext-a', 'Expenses:Groceries');

    const queue = suspenseQueue(db);
    expect(queue).toHaveLength(1);
    expect(queue[0].externalId).toBe('ext-b');
    expect(doctor(db, ledgerPath).suspenseCount).toBe(1);
  });

  test('an unidentified inflow behaves the same way', () => {
    postJournal(db, {
      externalId: 'ext-inflow',
      transactionDate: '2026-10-12',
      description: 'Deposit from BURKE H A',
      sourceAccountId: 'acc_cheque',
      status: 'TRANSFER',
      ruleId: null,
      postings: [posting('Assets:BNZ:Cheque', 'debit', 20000), posting('Income:Unidentified', 'credit', 20000)],
    });

    const before = suspenseQueue(db);
    expect(before).toHaveLength(1);
    expect(before[0].account).toBe('Income:Unidentified');

    reclassify(db, 'ext-inflow', 'Income:Gift');
    expect(suspenseQueue(db)).toHaveLength(0);
    expect(doctor(db, ledgerPath).suspenseCount).toBe(0);
  });
});
