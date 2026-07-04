# YouInc Ledger

Local-first Personal ERP and Akahu/BNZ Open Finance ledger engine.

## What it does

- Pulls Akahu transactions with pagination, rate limiting, and graceful HTTP error handling.
- Caches raw transactions idempotently using Akahu `_id` or deterministic fallback hashes.
- Posts only settled transactions to a strict double-entry SQLite ledger.
- Routes transactions through hot-reloadable YAML rules with NZFCC fallback and suspense safety.
- Exports hledger-compatible plain text accounting journals.

See `docs/architecture_design.md` for the Phase 1 architecture design, `docs/persona_frontend_information_design.md` for the persona-led frontend, information model, and ingestion design, and `docs/research_competitors.md` for the competitor landscape, positioning, and pricing research.

## Quick start

The TypeScript/Supabase-backed frontend in `frontend/` is the only implementation;
see the section below to run it.

## TanStack Start frontend

A React frontend lives in `frontend/` and reads the same local SQLite ledger through TanStack Start server functions. It also exposes local live-ingestion controls and source-account mapping edits backed by `config/rules.yaml`. The frontend uses [pnpm](https://pnpm.io/).

The same app serves the public marketing site: the landing page at `/`, a live demo at
`/demo` (the real dashboard UI running on sample data — layout edits persist under a separate
localStorage key and never touch your real board), the bespoke-service page at
`/custom-builds`, and a live widget catalogue at `/widgets`. Everything else is
passkey-gated (see "Publishing the frontend publicly" below).

To run it:

```sh
cd frontend
pnpm install
pnpm dev
```

Then open `http://localhost:3000`. Use the Ingestion panel to sync a live Akahu account. Click **Load Akahu accounts** and select the real Akahu account id (`acc_...`) rather than entering a bank label such as `BNZ`. Use Source Systems to map raw account IDs to ledger accounts before ongoing syncs. By default it reads `../data/youinc-ledger.sqlite3` from the frontend directory. Set `YOUINC_DB_PATH` if your ledger database is elsewhere:

```sh
YOUINC_DB_PATH=/absolute/path/to/youinc-ledger.sqlite3 pnpm dev
```

Optional frontend ingestion environment variables:

```sh
YOUINC_RULES_PATH=/absolute/path/to/rules.yaml
YOUINC_PROJECT_ROOT=/absolute/path/to/YouInc
AKAHU_CA_BUNDLE=/absolute/path/to/network-or-corporate-ca.pem
```

### Publishing the frontend publicly

The dashboard reads your real financial ledger, so it is gated behind a
**passkey (WebAuthn)** login — every route except the public marketing pages
(`/`, `/demo`, `/custom-builds`, `/widgets`) redirects to `/login` until you
authenticate. To enrol your first passkey, set `YOUINC_ENROLLMENT_TOKEN` (in
`frontend/.env` or your host's env settings), open `/login`, use "Enrol a new
passkey", then unset the token to disable further registration. After that,
"Sign in with passkey" is all you need. Serve the deployed frontend over HTTPS
(WebAuthn requires a secure context outside localhost). The relying-party
id/origin are derived from the request by default; override with `YOUINC_RP_ID`
/ `YOUINC_RP_ORIGIN` only behind a proxy that rewrites Host/Origin. See
`frontend/src/server/auth.ts` and `frontend/src/start.ts` for the
implementation.

To actually host it, see `docs/deploy_fly.md` for a Fly.io setup that scales
to zero (a `Dockerfile` at the repo root packages the built frontend, backed
by a Fly Volume for the SQLite ledger and `rules.yaml` — no changes to the
local-first architecture).

If `pnpm install` fails with `ECONNREFUSED` against `127.0.0.1:8080`, run it with local proxy variables unset:

```sh
env -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY -u https_proxy -u http_proxy -u all_proxy pnpm install
```

Akahu sync ignores generic `REQUESTS_CA_BUNDLE`, `SSL_CERT_FILE`, and `CURL_CA_BUNDLE` values so local mitmproxy/corporate cert settings do not silently affect banking ingestion. If live sync must run on a TLS-inspecting network, set `AKAHU_CA_BUNDLE` to that network's PEM CA bundle and restart the frontend.

## Live Akahu sync

Set these in `.env` or as environment variables:

- `AKAHU_BASE_URL`
- `AKAHU_APP_TOKEN`
- `AKAHU_USER_TOKEN`

## Safety notes

- Pending transactions are cached but not posted by default.
- Every journal posting is validated so debits equal credits before commit.
- Unmatched transactions route to `Expenses:Uncategorized:Suspense`.
- Real credentials and local database files are ignored by git.
