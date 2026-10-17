#!/usr/bin/env node
import { parseArgs as nodeParseArgs } from 'node:util';
import { openLedger } from './database.ts';
import { reconcile, formatCents, toCents } from './balances.ts';
import { doctor } from './doctor.ts';
import { loadRoutingConfig, upsertRule, disableRule, listRules } from './config.ts';
import { applyPairs, candidates, proposePairs } from './transfers.ts';
import { reclassify, setManualBalance } from './adjust.ts';
import { monthlyCashflow, spendByAccount, incomeByAccount, suspenseQueue, accountMappings } from './reports.ts';
import { sync } from './sync.ts';
import { AkahuError } from './akahu.ts';

/**
 * `youinc` — the agent-facing CLI.
 *
 * Design rules, in order of importance:
 *   1. JSON on stdout by default. A human table is `--human`. I am the primary
 *      consumer, so machine-readable is the default, not an afterthought.
 *   2. Exit 0 for a successful call that found problems (drift, suspense); exit
 *      2 only when the command could not be carried out. A doctor finding of
 *      "unexplained $40" is data, not a crash.
 *   3. Never print a secret. Credentials are read from the environment and
 *      echoed only as present/absent.
 *   4. Every mutation is dry-runnable where it has consequences.
 */

type Args = { _: string[]; [key: string]: string | boolean | string[] | undefined };

/**
 * Thin wrapper over node:util parseArgs. Hand-rolled parsing lost values that
 * looked like flags (`--to Expenses:X` is fine, but `--match-regex '$5'` is
 * only safe when the parser knows the option takes a value), so the standard
 * parser owns it.
 */
function parseArgs(argv: string[]): Args {
  const spec: Record<string, { type: 'string' | 'boolean' }> = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const name = raw.slice(2).split('=')[0];
    // Everything except the switches that mean "yes/no" takes a value.
    spec[name] = { type: ['human', 'dry-run', 'refresh', 'help'].includes(name) ? 'boolean' : 'string' };
  }
  const parsed = nodeParseArgs({ args: argv, options: spec, allowPositionals: true, strict: false });
  const args: Args = { _: parsed.positionals as string[] };
  for (const [rawKey, value] of Object.entries(parsed.values)) {
    const key = rawKey.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    args[key] = Array.isArray(value) ? (value as string[]) : (value as string | boolean);
  }
  return args;
}

function string(args: Args, key: string): string | undefined {
  const value = args[key];
  if (Array.isArray(value)) return value[value.length - 1];
  return typeof value === 'string' ? value : undefined;
}

function flag(args: Args, key: string): boolean {
  return args[key] === true || args[key] === 'true';
}

function emit(payload: unknown, human: string | null, args: Args): void {
  if (human && flag(args, 'human')) process.stdout.write(`${human}\n`);
  else process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  return [line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

const USAGE = `youinc — agent-first personal ledger

  youinc sync [--refresh] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--only acc_id] [--dry-run]
      Refresh balances, anchor them, import transactions, pair transfers.
      Requires AKAHU_APP_TOKEN and AKAHU_USER_TOKEN in the environment.

  youinc balances [--human]
      Every mapped account: bank-reported balance, its age, the ledger's
      independent figure, and whether they agree.

  youinc reconcile [--human] [--stale-after-hours N]
      Only the accounts that do not agree, with the gap explained.

  youinc accounts [--human]          Mapped accounts and their ledger paths.
  youinc refresh                     Ask Akahu to refresh balances now.

  youinc doctor [--human]            Unbalanced journals, duplicates, unmapped
                                     accounts, missing anchors, last syncs.

  youinc spend [--from] [--to] [--group-by top|account|month] [--human]
  youinc income [--from] [--to] [--human]
  youinc cashflow [--from] [--to] [--human]
  youinc suspense [--limit N] [--human]

  youinc pair-transfers [--dry-run] [--window-days N] [--human]
  youinc reclassify <external-id> --to <Ledger:Account>
  youinc set-balance <acc_id> <amount> --as-of YYYY-MM-DD

  youinc rule add --key K --match-regex R [--merchant-regex R] --to Ledger:Account
                  [--priority N] [--memo TEXT]
  youinc rule list | youinc rule disable <key>

  youinc status                      Version, paths, credential presence.

Global: --db <path> (default ~/.youinc/ledger.sqlite3, or YOUINC_DB_PATH).
`;

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const command = (args._ as string[])[0];

  if (!command || command === 'help' || flag(args, 'help')) {
    process.stdout.write(USAGE);
    return 0;
  }

  if (command === 'status') {
    const ledger = openLedger(string(args, 'db'));
    emit(
      {
        ledgerPath: ledger.path,
        credentials: {
          appToken: Boolean(process.env.AKAHU_APP_TOKEN),
          userToken: Boolean(process.env.AKAHU_USER_TOKEN),
          baseUrl: process.env.AKAHU_BASE_URL ?? 'https://api.akahu.io/v1',
        },
        schemaVersion: (ledger.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
      },
      null,
      args,
    );
    return 0;
  }

  const ledger = openLedger(string(args, 'db'));
  const db = ledger.db;

  switch (command) {
    case 'sync': {
      const report = await sync(db, {
        refresh: flag(args, 'refresh'),
        from: string(args, 'from'),
        to: string(args, 'to'),
        only: string(args, 'only') ? [string(args, 'only') as string] : undefined,
        dryRun: flag(args, 'dry-run'),
      });
      const failed = report.accounts.filter((a) => a.status === 'error');
      emit(report, table(
        ['account', 'status', 'balance', 'refreshed', 'txns', 'posted'],
        report.accounts.map((a) => [
          a.ledgerAccount, a.status, a.balanceCents === null ? '—' : formatCents(a.balanceCents),
          a.balanceRefreshedAt ?? '—', String(a.transactions), String(a.posted),
        ]).concat([['pairs applied', String(report.appliedPairs), '', '', '', '']]),
      ), args);
      return failed.length ? 2 : 0;
    }

    case 'balances': {
      const accounts = reconcile(db);
      const human = table(
        ['account', 'reported', 'age(h)', 'ledger', 'status'],
        accounts.map((a) => [
          a.ledgerAccount,
          a.reportedCents === null ? '—' : formatCents(a.reportedCents),
          a.reportedAgeHours === null ? '—' : String(a.reportedAgeHours),
          a.ledgerCents === null ? '—' : formatCents(a.ledgerCents),
          a.status,
        ]),
      );
      emit({ accounts, netWorthCents: netWorth(accounts) }, human, args);
      return 0;
    }

    case 'reconcile': {
      const staleAfterHours = string(args, 'stale-after-hours') ? Number(string(args, 'stale-after-hours')) : undefined;
      const accounts = reconcile(db, { staleAfterHours });
      const disagreements = accounts.filter((a) => a.gap.length > 0 || a.status === 'stale' || a.status === 'error');
      emit(
        { disagreements, checked: accounts.length },
        disagreements.length
          ? table(['account', 'status', 'gap'], disagreements.map((a) => [
              a.ledgerAccount, a.status,
              a.gap.map((g) => `${g.cents > 0 ? '+' : ''}${formatCents(g.cents)} [${g.class}] ${g.explanation}`).join(' | ') || 'none',
            ]))
          : 'All feed accounts agree with the bank.',
        args,
      );
      return 0;
    }

    case 'accounts': {
      const accounts = accountMappings(db);
      emit({ accounts }, table(
        ['ledger', 'akahu id', 'feed', 'type', 'name'],
        accounts.map((a) => [a.ledgerAccount, a.akahuAccountId, a.hasFeed ? 'yes' : 'balance-only', a.accountType, a.name]),
      ), args);
      return 0;
    }

    case 'refresh': {
      const { akahuConfigFromEnv, AkahuClient } = await import('./akahu.ts');
      const client = new AkahuClient(akahuConfigFromEnv());
      await client.refresh();
      emit({ refreshed: true }, 'Akahu refresh requested.', args);
      return 0;
    }

    case 'doctor': {
      const report = doctor(db, ledger.path);
      emit(report, [
        `ledger: ${report.ledgerPath} (schema v${report.schemaVersion})`,
        `journals: ${report.unbalancedJournals.length} unbalanced, ${report.duplicateJournals} duplicate ids`,
        `accounts: ${report.accounts.length} mapped, ${report.unmappedAccounts.length} unmapped, ${report.missingAnchors.length} unanchored`,
        `suspense: ${report.suspenseCount} pending classification`,
        report.problems.length ? `problems:\n  ${report.problems.join('\n  ')}` : 'problems: none',
      ].join('\n'), args);
      return 0;
    }

    case 'spend': {
      const range = dateRange(args);
      const groupBy = (string(args, 'group-by') ?? 'top') as 'top' | 'account' | 'month';
      const rows = spendByAccount(db, range.from, range.to, groupBy);
      emit({ from: range.from, to: range.to, totalCents: rows.reduce((s, r) => s + r.cents, 0), rows }, table(
        [groupBy === 'month' ? 'month' : 'group', 'spend', 'count'],
        rows.map((r) => [r.group, formatCents(r.cents), String(r.count)]),
      ), args);
      return 0;
    }

    case 'income': {
      const range = dateRange(args);
      const rows = incomeByAccount(db, range.from, range.to);
      emit({ from: range.from, to: range.to, totalCents: rows.reduce((s, r) => s + r.cents, 0), rows }, table(
        ['account', 'income', 'count'],
        rows.map((r) => [r.group, formatCents(r.cents), String(r.count)]),
      ), args);
      return 0;
    }

    case 'cashflow': {
      const range = dateRange(args);
      const months = monthlyCashflow(db, range.from, range.to);
      emit({ from: range.from, to: range.to, months }, table(
        ['month', 'income', 'spend', 'net'],
        months.map((m) => [m.month, formatCents(m.incomeCents), formatCents(m.spendCents), formatCents(m.netCents)]),
      ), args);
      return 0;
    }

    case 'suspense': {
      const limit = string(args, 'limit') ? Number(string(args, 'limit')) : 50;
      const rows = suspenseQueue(db, limit);
      emit({ count: rows.length, rows }, table(
        ['date', 'description', 'amount', 'external id'],
        rows.map((r) => [r.transactionDate, r.description.slice(0, 40), formatCents(r.cents), r.externalId.slice(0, 16)]),
      ), args);
      return 0;
    }

    case 'pair-transfers': {
      const windowDays = string(args, 'window-days') ? Number(string(args, 'window-days')) : 3;
      const proposed = proposePairs(candidates(db), windowDays);
      if (flag(args, 'dry-run')) {
        emit(proposed, table(
          ['date', 'from', 'to', 'amount', 'gap(days)'],
          proposed.pairs.map((p) => [p.transferDate, p.from.ledgerAccount, p.to.ledgerAccount, formatCents(p.amountCents), String(p.dayGap)]),
        ), args);
        return 0;
      }
      const applied = applyPairs(db, loadRoutingConfig(db), proposed.pairs);
      const remaining = proposePairs(candidates(db), windowDays);
      emit({ applied: applied.applied, errors: applied.errors, remaining: remaining.pairs.length, unpaired: remaining.unpaired.length }, table(
        ['applied', 'errors', 'unpaired'],
        [[String(applied.applied), String(applied.errors.length), String(remaining.unpaired.length)]],
      ), args);
      return applied.errors.length ? 2 : 0;
    }

    case 'reclassify': {
      const externalId = (args._ as string[])[1];
      const target = string(args, 'to');
      if (!externalId || !target) {
        process.stderr.write('usage: youinc reclassify <external-id> --to <Ledger:Account>\n');
        return 2;
      }
      const result = reclassify(db, externalId, target);
      emit(result, `Reclassified ${formatCents(result.amountCents)}: ${result.fromAccount} → ${result.toAccount}`, args);
      return 0;
    }

    case 'set-balance': {
      const account = (args._ as string[])[1];
      const amount = toCents((args._ as string[])[2] ?? '');
      const asOf = string(args, 'as-of') ?? new Date().toISOString().slice(0, 10);
      if (!account || amount === null) {
        process.stderr.write('usage: youinc set-balance <acc_id> <amount> --as-of YYYY-MM-DD\n');
        return 2;
      }
      setManualBalance(db, account, amount, asOf);
      emit({ account, balanceCents: amount, asOf }, `Balance for ${account} set to ${formatCents(amount)} as of ${asOf}.`, args);
      return 0;
    }

    case 'rule': {
      const sub = (args._ as string[])[1];
      if (sub === 'add') {
        const key = string(args, 'key');
        const target = string(args, 'to');
        if (!key || !target) {
          process.stderr.write('usage: youinc rule add --key K --match-regex R --to Ledger:Account\n');
          return 2;
        }
        upsertRule(db, {
          key,
          priority: string(args, 'priority') ? Number(string(args, 'priority')) : undefined,
          matchRegex: string(args, 'matchRegex') ?? null,
          merchantRegex: string(args, 'merchantRegex') ?? null,
          amountAbsGreaterThan: string(args, 'amountAbsGreaterThan') ? Number(string(args, 'amountAbsGreaterThan')) : null,
          targetAccount: target,
          memo: string(args, 'memo') ?? null,
        });
        emit({ ok: true, key, targetAccount: target }, `Rule ${key} → ${target}`, args);
        return 0;
      }
      if (sub === 'disable') {
        const key = (args._ as string[])[2];
        if (!key) { process.stderr.write('usage: youinc rule disable <key>\n'); return 2; }
        const changed = disableRule(db, key);
        emit({ ok: changed, key }, changed ? `Rule ${key} disabled.` : `No rule ${key}.`, args);
        return changed ? 0 : 2;
      }
      const rules = listRules(db);
      emit({ rules }, table(
        ['key', 'priority', 'enabled', 'pattern', 'target'],
        rules.map((r) => [String(r.key), String(r.priority), String(r.enabled),
          String(r.descriptionRegex ?? r.merchantRegex ?? r.amountAbsGreaterThan ?? ''), String(r.targetAccount)]),
      ), args);
      return 0;
    }

    default:
      process.stderr.write(`unknown command: ${command}\n\n${USAGE}`);
      return 2;
  }
}

function dateRange(args: Args): { from: string; to: string } {
  const to = string(args, 'to') ?? new Date().toISOString().slice(0, 10);
  const from = string(args, 'from') ?? new Date(Date.parse(to) - 30 * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

/** Net worth needs no journal arithmetic: the anchors are the balances. */
function netWorth(accounts: ReturnType<typeof reconcile>): number {
  let total = 0;
  for (const account of accounts) {
    const amount = account.reportedCents ?? account.ledgerCents;
    if (amount === null) continue;
    total += account.accountType === 'liability' ? -Math.abs(amount) : amount;
  }
  return total;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof AkahuError ? `${error.message} (${error.status ?? 'no status'})` : error instanceof Error ? error.message : String(error);
    process.stderr.write(`youinc: ${message}\n`);
    process.exit(error instanceof AkahuError ? 2 : 1);
  });
