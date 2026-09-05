import { beforeEach, afterEach, test, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { closeDatabase, rows, execute, insertJournal, setting } from './database';
import { getWorkspaceLedger, upsertWorkspaceBalance, deleteWorkspaceBalance } from './workspaceLedger';
import { getWorkspaceDashboard } from './workspaceDashboard';
import { loadSampleData } from './sampleIngestion';
import { ingestPayloads } from './ingestion';
import { reclassifySuspenseItem } from './reclassify';
import { addManualTransaction } from './manualTransactions';
import { backupDatabase, exportJournal } from './dataExport';
import { allowLocalRequest } from './localAccess';
import { createRule, listRules } from './rules';
let dir: string;
const previousPath = process.env.YOUINC_DB_PATH;
beforeEach(() => {dir = mkdtempSync(join(tmpdir(),'youinc-test-')); process.env.YOUINC_DB_PATH=join(dir,'ledger.sqlite3');});
afterEach(() => {closeDatabase(); rmSync(dir,{recursive:true,force:true}); if(previousPath) process.env.YOUINC_DB_PATH=previousPath; else delete process.env.YOUINC_DB_PATH; delete process.env.YOUINC_DEMO;});

test('fresh start and balances survive reopening', async () => {
  expect((await getWorkspaceLedger()).totals.netWorthCents).toBe(0);
  await upsertWorkspaceBalance({account:'Assets:Bank:Everyday',balanceCents:123456}); closeDatabase();
  expect((await getWorkspaceLedger()).totals.netWorthCents).toBe(123456);
  await deleteWorkspaceBalance('Assets:Bank:Everyday');
  expect((await getWorkspaceLedger()).totals.netWorthCents).toBe(0);
});
test('sample import is idempotent, balanced, with pending transactions skipped', async () => {
  const first = await loadSampleData(); expect(first.posted).toBe(5); expect(first.skippedPending).toBe(1);
  const next = await loadSampleData(); expect(next.posted).toBe(0); expect(next.skippedDuplicate).toBe(5);
  expect(rows('SELECT * FROM journal_entries')).toHaveLength(10);
  const dashboard = await getWorkspaceDashboard();
  expect(dashboard.totals.netWorthCents).toBe(291761); expect(dashboard.suspenseQueue).toHaveLength(1);
});
test('a failed batch rolls back raw data and journal entries', async () => {
  await loadSampleData();
  await expect(ingestPayloads([
    {_id:'good',_account:'acc_youinc_sample',amount:-2,date:'2026-09-01',currency:'NZD',status:'SETTLED',description:'coffee'},
    {_id:'bad',_account:'acc_youinc_sample',amount:-3,date:'2026-09-01',currency:'USD',status:'SETTLED',description:'wrong currency'},
  ])).rejects.toThrow('no transactions were saved');
  expect(rows('SELECT * FROM journal_entries')).toHaveLength(10);
  expect(rows('SELECT * FROM raw_transactions')).toHaveLength(6);
});
test('failed posting cannot leave a header behind', () => {
  execute(`CREATE TRIGGER fail_entry BEFORE INSERT ON journal_entries BEGIN SELECT RAISE(ABORT,'test failure'); END`);
  expect(() => insertJournal({externalId:'broken',transactionDate:'2026-09-05',description:'test',sourceAccountId:'test',status:'posted',ruleId:null,
    postings:[{account:'Assets:Bank',side:'debit',amountCents:100,currency:'NZD'},{account:'Income:Test',side:'credit',amountCents:100,currency:'NZD'}]})).toThrow('test failure');
  expect(rows('SELECT * FROM journal_transactions')).toHaveLength(0);
});
test('reclassification appends a correction and cannot run twice', async () => {
  await loadSampleData(); const original = (await getWorkspaceDashboard()).suspenseQueue[0];
  await reclassifySuspenseItem({externalId:original.externalId,targetAccount:'Expenses:Cash'});
  expect((await getWorkspaceDashboard()).suspenseQueue).toHaveLength(0);
  expect(rows('SELECT * FROM journal_transactions')).toHaveLength(6);
  await expect(reclassifySuspenseItem({externalId:original.externalId,targetAccount:'Expenses:Other'})).rejects.toThrow('already be resolved');
});
test('manual entry retries are idempotent and update reporting', async () => {
  const input = {id:randomUUID(),date:'2026-09-05',description:'Lunch',account:'Assets:Bank:Everyday',category:'Expenses:Food',amountCents:1250,direction:'expense' as const};
  await addManualTransaction(input); await addManualTransaction(input);
  const dashboard = await getWorkspaceDashboard();
  expect(dashboard.totals.expensesCents).toBe(1250); expect(dashboard.totals.netWorthCents).toBe(-1250);
  expect(exportJournal()).toContain('Expenses:Food  12.50 NZD');
});
test('backup captures live data and opens independently', async () => {
  await loadSampleData(); const path = join(dir,'backup.sqlite3'); writeFileSync(path,await backupDatabase());
  const backup = new DatabaseSync(path,{readOnly:true});
  expect(backup.prepare('PRAGMA integrity_check').get()?.integrity_check).toBe('ok');
  expect(backup.prepare('SELECT COUNT(*) AS n FROM journal_transactions').get()?.n).toBe(5); backup.close();
});
test('sample loading preserves user edits to rules', async () => {
  await createRule({ruleKey:'sample_salary',priority:1,isEnabled:false,matchDescriptionRegex:'salary',matchMerchantRegex:null,
    matchAmountGreaterThan:null,matchAmountAbsGreaterThan:null,targetAccount:'Income:Custom',memo:null});
  await loadSampleData(); const rule=(await listRules()).find(r=>r.ruleKey==='sample_salary');
  expect(rule?.isEnabled).toBe(false); expect(rule?.targetAccount).toBe('Income:Custom');
});
test('demo cannot read an already-open personal database', () => {
  expect(setting('currency')).toBe('NZD'); process.env.YOUINC_DEMO='1';
  expect(() => setting('currency')).toThrow('unavailable in demo');
});
test('local requests reject foreign origins and rebinding hosts', () => {
  expect(allowLocalRequest('http://127.0.0.1:3000/app',null)).toBe(true);
  expect(allowLocalRequest('http://localhost:3000/app','http://localhost:3000')).toBe(true);
  expect(allowLocalRequest('http://attacker.example:3000/app',null)).toBe(false);
  expect(allowLocalRequest('http://localhost:3000/app','https://attacker.example')).toBe(false);
});

test('restore checks a backup and refuses to overwrite existing data', async () => {
  const {spawnSync} = await import('node:child_process');
  await loadSampleData();
  const source=join(dir,'backup.sqlite3'); const destination=join(dir,'restored.sqlite3');
  writeFileSync(source,await backupDatabase());
  const script=new URL('../../../scripts/restore.mjs',import.meta.url).pathname;
  const result=spawnSync(process.execPath,[script,source,destination],{encoding:'utf8'});
  expect(result.status,result.stderr).toBe(0);
  const db=new DatabaseSync(destination,{readOnly:true});
  expect(db.prepare('SELECT COUNT(*) AS n FROM journal_transactions').get()?.n).toBe(5); db.close();
  const again=spawnSync(process.execPath,[script,source,destination],{encoding:'utf8'});
  expect(again.status).toBe(1); expect(again.stderr).toContain('Destination exists');
});

test('account mapping edits persist and conflicting mappings are rejected', async () => {
  const {createAccountMapping,updateAccountMapping,deleteAccountMapping,listAccountMappings} = await import('./accountMappings');
  const input={akahuAccountId:'acc_test',ledgerAccount:'Assets:Bank:Test',accountType:'asset' as const,creditLimitCents:null};
  const [mapping]=await createAccountMapping(input);
  await expect(createAccountMapping(input)).rejects.toThrow();
  await updateAccountMapping(mapping.id,{...input,ledgerAccount:'Assets:Bank:Renamed'});
  closeDatabase(); expect((await listAccountMappings())[0].ledgerAccount).toBe('Assets:Bank:Renamed');
  await deleteAccountMapping(mapping.id); expect(await listAccountMappings()).toHaveLength(0);
});

test('optional Akahu sync records outcomes and revocation disables access', async () => {
  const {vi} = await import('vitest');
  const {AkahuClient} = await import('./akahuClient');
  const {syncAkahuAccount,disconnectAkahu,getAkahuConnectionStatus,listSyncLog} = await import('./akahuConnection');
  const app=process.env.AKAHU_APP_TOKEN, user=process.env.AKAHU_USER_TOKEN;
  process.env.AKAHU_APP_TOKEN='test-app'; process.env.AKAHU_USER_TOKEN='test-user';
  try {
    await loadSampleData();
    vi.spyOn(AkahuClient.prototype,'iterTransactions').mockImplementation(async function* () {
      yield {_id:'sync-test',_account:'acc_youinc_sample',amount:-25,date:'2026-09-01',currency:'NZD',status:'SETTLED',description:'Groceries'};
    });
    vi.spyOn(AkahuClient.prototype,'revokeToken').mockResolvedValue(undefined);
    expect((await syncAkahuAccount('acc_youinc_sample')).posted).toBe(1);
    expect((await syncAkahuAccount('acc_youinc_sample')).posted).toBe(0);
    expect((await listSyncLog())[0].status).toBe('success');
    await disconnectAkahu(); expect((await getAkahuConnectionStatus()).connected).toBe(false);
    await expect(syncAkahuAccount('acc_youinc_sample')).rejects.toThrow('credentials');
  } finally {
    vi.restoreAllMocks();
    if(app) process.env.AKAHU_APP_TOKEN=app; else delete process.env.AKAHU_APP_TOKEN;
    if(user) process.env.AKAHU_USER_TOKEN=user; else delete process.env.AKAHU_USER_TOKEN;
  }
});
