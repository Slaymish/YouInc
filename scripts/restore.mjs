#!/usr/bin/env node
import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export async function restore(source, destination) {
  const target = resolve(destination);
  if (existsSync(target)) throw new Error('Destination exists. Choose a new path; existing data is never overwritten.');
  const db = new DatabaseSync(resolve(source), {readOnly:true});
  let reserved = false;
  try {
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version !== 1) throw new Error('Unsupported YouInc backup version.');
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Backup integrity check failed.');
    for (const table of ['settings','manual_account_balances','classification_rules','account_mappings','raw_transactions','akahu_sync_log']) db.prepare(`SELECT * FROM ${table} LIMIT 0`).all();
    const bad = db.prepare(`SELECT t.id FROM journal_transactions t LEFT JOIN journal_entries e ON e.journal_transaction_id=t.id
      GROUP BY t.id HAVING COUNT(e.id)<2 OR COUNT(DISTINCT e.currency)<>1 OR MIN(e.amount_cents)<=0
      OR SUM(CASE WHEN e.side='debit' THEN e.amount_cents ELSE -e.amount_cents END)<>0`).all();
    if (bad.length) throw new Error('Backup contains an invalid journal.');
    mkdirSync(dirname(target), {recursive:true, mode:0o700});
    writeFileSync(target, '', {flag:'wx', mode:0o600}); reserved=true;
    await backup(db,target); chmodSync(target,0o600);
  } catch (error) {if (reserved) rmSync(target,{force:true}); throw error;}
  finally {db.close();}
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source,destination] = process.argv.slice(2);
  if (!source || !destination) {console.error('Usage: node scripts/restore.mjs backup.sqlite3 NEW-destination.sqlite3'); process.exitCode=1;}
  else try {await restore(source,destination); console.log('Restored. Set YOUINC_DB_PATH to the destination and restart YouInc.');}
  catch(error) {console.error(error.message); process.exitCode=1;}
}
