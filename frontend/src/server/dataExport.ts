import { mkdtempSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backup } from 'node:sqlite';
import { getDatabase } from './database';
import { readJournalEntries } from './workspaceJournal';
export async function backupDatabase(): Promise<Uint8Array> {
  const db = getDatabase();
  const dir = mkdtempSync(join(tmpdir(), 'youinc-backup-'));
  try {
    const path = join(dir,'ledger.sqlite3');
    await backup(db, path); chmodSync(path, 0o600);
    return new Uint8Array(readFileSync(path));
  } finally { rmSync(dir, {recursive: true, force: true}); }
}
export function exportJournal(): string {
  const groups = new Map<string, ReturnType<typeof readJournalEntries>>();
  for (const entry of readJournalEntries()) {
    const group = groups.get(entry.transactionId) ?? []; group.push(entry); groups.set(entry.transactionId,group);
  }
  const clean = (s: string) => s.replace(/[\r\n\t]/g,' ').replace(/ {2,}/g,' ');
  return '; YouInc ledger export. Manual balance snapshots are in the database backup.\n\n' +
    [...groups.values()].map(entries => `${entries[0].transactionDate} ${clean(entries[0].description)}\n` +
      entries.map(e => `    ${clean(e.account)}  ${e.side === 'credit' ? '-' : ''}${BigInt(e.amountCents)/100n}.${String(BigInt(e.amountCents)%100n).padStart(2,'0')} ${e.currency}`).join('\n')).join('\n\n') + '\n';
}
