# YouInc

Personal finance dashboard with a local SQLite ledger. Read `README.md` before
changes; use the checked-in documentation under `docs/` for relevant decisions.

## Development and verification

Run from `frontend/`: `pnpm dev`, `pnpm test`, `pnpm build`, and, for browser-flow
changes, `pnpm test:e2e`. Use the existing pnpm lockfile.
The root launchers are `node scripts/setup.mjs` and `node scripts/start.mjs`.
Setup installs dependencies and builds the application; it is not a prerequisite
for documentation edits.

## Data and behavior

- Preserve balanced double-entry postings, transactional migrations and
  idempotent bank imports.
- Test with temporary databases, never the user's `~/.youinc/ledger.sqlite3`.
- Personal mode stays bound to loopback. Preserve Host and cross-origin guards.
- Demo mode must not access the personal ledger, backups or exports.
- Keep bank credentials in environment configuration; never copy them into
  source, instructions, memories or commits.
- Treat bank sync, token revocation, restoring real data and public deployment
  as explicit user actions, not incidental development checks.

Use the Slaymish GitHub identity for this personal repository. Select credentials
per command rather than changing the default work account.
