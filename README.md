# YouInc

A personal money dashboard that runs on your computer. Track accounts, record
income and expenses, review spending, and see your net worth. Transactions use
a double-entry ledger so the numbers remain inspectable.

**One app. One SQLite file. No signup, cloud database, or containers.**

## Run it yourself

Install [Node.js](https://nodejs.org/) **22.13 or newer**, download or clone this
repository, and run from its root:

```sh
node scripts/setup.mjs
node scripts/start.mjs
```

Setup installs the locked dependencies and builds the app. It needs an internet
connection on first install. Everyday use needs no internet unless you enable
bank sync. Open **http://127.0.0.1:3000**. Your dashboard is ready immediately.
Stop with Ctrl-C and start again with the same command; your data remains.

Start by adding account balances in **Accounts**, then record income or expenses
in **Activity**. **Spending** and **Net worth** summarise your ledger. **Workshop**
holds optional sorting rules and bank-account mappings. Try `/demo` to explore
sample data without changing your own ledger.

YouInc currently uses **NZD**, with no currency conversion. Manually maintained
balances override transaction-derived balances for those accounts; update those
snapshots as your balances change. Transactions still appear in spending reports.

## Your data

The app creates `~/.youinc/ledger.sqlite3` automatically. It includes transactions,
manual balances, rules, account mappings and settings. No data is sent to the
author and there is no product telemetry. Dashboard layout preferences stay in
your browser.

To choose another location, set `YOUINC_DB_PATH` to an absolute filename in
`frontend/.env.local` (see `frontend/.env.example`). Keep the database on a local
disk, not a shared network filesystem. Files are private to your operating-system
account where POSIX permissions are supported; they are not encrypted by YouInc.

## Back up and restore

Use **Settings → Download database backup**. This takes a consistent SQLite
snapshot even while the app is running. Keep a copy on a separate device.
**Export ledger journal** produces hledger-compatible text for transactions;
it does not include balance snapshots or settings and is not a full backup.

To restore, stop YouInc and run:

```sh
node scripts/restore.mjs /path/to/youinc-backup.sqlite3 /path/to/restored.sqlite3
```

The restore command checks database integrity and journal balance, and refuses
to overwrite an existing file. Set `YOUINC_DB_PATH=/path/to/restored.sqlite3` in
`frontend/.env.local`, then restart. Bank credentials live in the environment
file, not the database backup. Back up that file separately if you use bank sync.

## Updates

Download/pull the new source, run setup again, then restart. Setup never resets
or deletes your database. Schema migrations run transactionally when the app
opens the database. Back up before upgrading; retain the old source and backup
if you need to go back to an earlier version.

## Optional New Zealand bank sync

Manual accounts and transaction entry work without bank credentials. For Akahu,
put your own personal app and enduring user tokens in `frontend/.env.local`:

```dotenv
AKAHU_APP_TOKEN=your-app-token
AKAHU_USER_TOKEN=your-user-token
```

Restart, add account mappings in Workshop, then load and sync your accounts in
Accounts. Sync is on demand, with a date range and a local history of outcomes.
Pending transactions are excluded; repeat imports do not duplicate postings.
Disconnect revokes the token at Akahu. Remove it from your environment file;
a replacement token requires restarting and enabling sync again in Settings.

## Local access and the public demo

The launcher binds to `127.0.0.1`. Personal mode rejects non-local Host and
cross-origin requests. There is no application login: anyone with access to
this computer's session can use the dashboard. Do not expose personal mode
through a public reverse proxy. To run it on your own server, keep it bound to
loopback and use an SSH tunnel (`ssh -L 3000:127.0.0.1:3000 your-server`).

For a public portfolio demo, set `YOUINC_DEMO=1`. This serves the project page
and sample-data demo and **disables access to the personal database**, including
backups and exports. Publishing the demo is a separate deployment decision.

## Development and checks

```sh
cd frontend
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm test:e2e
```

Node provides SQLite directly; there is no native database dependency to compile.
The local integration tests use temporary databases and cover posting, rollback,
reclassification, persistence, backup and restore. Browser tests use a separate
temporary database, never your personal one.

## Existing Supabase installations

This version does not connect to or modify the former database. Keep your old
instance and its backups while moving data. Automatic migration from the old
hosted schema is not included. A new installation starts with an empty ledger;
do not assume that existing cloud data has been transferred.

MIT licensed — see [LICENSE](LICENSE).
