import { atomic, rows, writeRecord } from './database';
import { ingestPayloads, type IngestResult } from './ingestion';

const SAMPLE_SOURCE_ACCOUNT = "acc_youinc_sample";

// A tiny, self-contained Akahu-shaped batch (mirrors tests/fixtures but scoped
// to a sample account id we also map below). Salary in, a couple of expenses,
// one pending (skipped), one asset purchase.
const SAMPLE_PAYLOADS: ReadonlyArray<Record<string, unknown>> = [
  {
    _id: "sample_salary_001",
    _account: SAMPLE_SOURCE_ACCOUNT,
    status: "SETTLED",
    date: "2026-06-01",
    settlement_date: "2026-06-01",
    amount: 5000.0,
    currency: "NZD",
    description: "ACME PAYROLL SALARY",
    merchant: { name: "ACME Payroll" },
    category: { nzfcc: "income" },
  },
  {
    _id: "sample_rent_001",
    _account: SAMPLE_SOURCE_ACCOUNT,
    status: "SETTLED",
    date: "2026-06-02",
    settlement_date: "2026-06-02",
    amount: -1800.0,
    currency: "NZD",
    description: "CITY PROPERTY RENT",
    merchant: { name: "City Property" },
    category: { nzfcc: "rent" },
  },
  {
    _id: "sample_spark_001",
    _account: SAMPLE_SOURCE_ACCOUNT,
    status: "SETTLED",
    date: "2026-06-03",
    settlement_date: "2026-06-04",
    amount: -89.99,
    currency: "NZD",
    description: "SPARK NZ LTD AUCKLAND NZ",
    merchant: { name: "Spark NZ" },
    category: { nzfcc: "software" },
  },
  {
    _id: "sample_pending_001",
    _account: SAMPLE_SOURCE_ACCOUNT,
    status: "PENDING",
    date: "2026-06-05",
    amount: -12.5,
    currency: "NZD",
    description: "PENDING COFFEE TEST",
    merchant: { name: "Coffee Test" },
  },
  {
    _id: "sample_groceries_001",
    _account: SAMPLE_SOURCE_ACCOUNT,
    status: "SETTLED",
    date: "2026-06-06",
    settlement_date: "2026-06-06",
    amount: -152.4,
    currency: "NZD",
    description: "COUNTDOWN SUPERMARKET",
    merchant: { name: "Countdown" },
    category: { nzfcc: "groceries" },
  },
  {
    // Deliberately unmatched by every STARTER_RULES regex and carries no
    // nzfcc category, so RulesRouter falls through to the workspace's suspense
    // account — the one item in the sample batch that demonstrates the
    // suspense queue + reclassify flow (see SuspenseQueueWidget.tsx /
    // reclassify.ts) rather than routing cleanly on load.
    _id: "sample_atm_001",
    _account: SAMPLE_SOURCE_ACCOUNT,
    status: "SETTLED",
    date: "2026-06-07",
    settlement_date: "2026-06-07",
    amount: -40.0,
    currency: "NZD",
    description: "ATM WITHDRAWAL QUEEN STREET",
    merchant: { name: "Cash Withdrawal" },
  },
];

interface StarterRule {
  rule_key: string;
  seq: number;
  priority: number;
  match_description_regex?: string;
  route_target_account: string;
}

const STARTER_RULES: StarterRule[] = [
  {
    rule_key: "sample_salary",
    seq: 0,
    priority: 100,
    match_description_regex: "(?i)payroll|salary",
    route_target_account: "Income:Salary",
  },
  {
    rule_key: "sample_rent",
    seq: 1,
    priority: 100,
    match_description_regex: "(?i)rent",
    route_target_account: "Expenses:Housing:Rent",
  },
  {
    rule_key: "sample_software",
    seq: 2,
    priority: 100,
    match_description_regex: "(?i)spark|vodafone|internet",
    route_target_account: "Expenses:Software",
  },
  {
    rule_key: "sample_groceries",
    seq: 3,
    priority: 100,
    match_description_regex: "(?i)countdown|new world|pak.?n.?save|supermarket",
    route_target_account: "Expenses:Groceries",
  },
];

export async function loadSampleData(): Promise<IngestResult> {
  atomic(() => {
    const now = new Date().toISOString();
    if (!rows('SELECT id FROM account_mappings WHERE akahu_account_id=?', SAMPLE_SOURCE_ACCOUNT).length) {
      writeRecord('account_mappings', {akahu_account_id: SAMPLE_SOURCE_ACCOUNT,
        ledger_account: 'Assets:Bank:Sample', account_type: 'asset', credit_limit_cents: null,
        created_at: now, updated_at: now});
    }
    for (const rule of STARTER_RULES) {
      if (rows('SELECT id FROM classification_rules WHERE rule_key=?', rule.rule_key).length) continue;
      const seq = rows<{seq: number}>('SELECT COALESCE(MAX(seq), -1) + 1 AS seq FROM classification_rules')[0].seq;
      writeRecord('classification_rules', {...rule, seq, match_description_regex: rule.match_description_regex ?? null});
    }
  });
  return ingestPayloads(SAMPLE_PAYLOADS);
}
