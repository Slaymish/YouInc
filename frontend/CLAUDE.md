# YouInc development

YouInc is a single-person money dashboard. Node 22.13+ provides SQLite through
`node:sqlite`. No hosted accounts, tenants, product telemetry, tiers or billing.

- `src/server/database.ts` opens the database, migrates its schema and owns
  transactional writes. Never write journal headers and postings separately.
- `src/server/ledger-engine/` is the pure double-entry and rules engine. Golden
  tests protect its existing behaviour.
- `src/server/workspace*.ts` assemble the shared dashboard data. A few internal
  workspace identifiers remain for the UI's saved layouts, not data isolation.
- `src/start.ts` applies local-origin and CSRF checks. The launcher binds only
  to loopback. Public demo mode must never open the personal database.
- Server functions dynamically import server modules; never send database or
  filesystem code to the browser.
- Manual accounts are balance snapshots, which supersede the journal balance
  for that account. Journal entries feed income and spending reports.
- The public `/demo` uses static data, independently of the real ledger.

Run `pnpm test`, `pnpm build`, and `pnpm test:e2e` in this directory. The README
is the source of truth for installation and operation. Legacy design documents
are historical, not requirements.
