// The existing routing engine writes directly to SQLite in one transaction.
import { atomic, rows, execute, insertJournal, setting } from './database';
import { LedgerPipeline, type LedgerStore, type PipelineResult } from './ledger-engine/pipeline';
import { RulesRouter, type RulesConfig } from './ledger-engine/rulesRouter';
import { listRules } from './rules';
import { listAccountMappings } from './accountMappings';

export interface IngestResult extends PipelineResult { workspaceId: string; }
export async function ingestPayloads(payloads: ReadonlyArray<Record<string, unknown>>): Promise<IngestResult> {
  const rules = await listRules();
  const mappings = await listAccountMappings();
  const config: RulesConfig = {
    defaults: {currency: setting('currency'), suspense_account: setting('suspense')},
    rules: rules.filter(r => r.isEnabled).map(r => ({id: r.ruleKey, priority: r.priority,
      match: {
        ...(r.matchDescriptionRegex ? {description_regex: r.matchDescriptionRegex} : {}),
        ...(r.matchMerchantRegex ? {merchant_regex: r.matchMerchantRegex} : {}),
        ...(r.matchAmountGreaterThan !== null ? {amount_greater_than: r.matchAmountGreaterThan} : {}),
        ...(r.matchAmountAbsGreaterThan !== null ? {amount_abs_greater_than: r.matchAmountAbsGreaterThan} : {}),
      }, route: {target_account: r.targetAccount, memo: r.memo ?? undefined}})),
    account_mappings: Object.fromEntries(mappings.map(m => [m.akahuAccountId, {
      ledger_account: m.ledgerAccount, account_type: m.accountType, credit_limit_cents: m.creditLimitCents ?? undefined,
    }])), nzfcc_mappings: {},
  };
  return atomic(() => {
    const store: LedgerStore = {
      upsertRawTransaction(t) {
        if (t.currency !== setting('currency')) throw new Error('This ledger supports NZD transactions only.');
        return Boolean(execute(`INSERT INTO raw_transactions VALUES (?,?,?,NULL,NULL)
          ON CONFLICT(idempotency_hash) DO NOTHING`, t.idempotencyHash, t.transactionDate, t.rawJson).changes);
      },
      markRawSkipped(id, reason) { execute('UPDATE raw_transactions SET skipped_reason=? WHERE idempotency_hash=?', reason, id); },
      journalExists(id) { return rows('SELECT id FROM journal_transactions WHERE external_id=?', id).length > 0; },
      insertJournalTransaction(journal) {
        const inserted = insertJournal(journal);
        execute('UPDATE raw_transactions SET processed_at=?, skipped_reason=NULL WHERE idempotency_hash=?', new Date().toISOString(), journal.externalId);
        return inserted;
      },
      getManualClassification() { return null; },
    };
    const result = new LedgerPipeline(store, new RulesRouter(config)).processPayloads(payloads);
    // A persistence or validation failure must not leave half of an import behind.
    if (result.errors.length) throw new Error(`Import failed; no transactions were saved. ${result.errors[0]}`);
    return {...result, workspaceId: 'local'};
  });
}
