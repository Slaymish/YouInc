# YouInc Ledger

Local-first Personal ERP and Akahu/BNZ Open Finance ledger engine.

## What it does

- Pulls Akahu transactions with pagination, rate limiting, and graceful HTTP error handling.
- Caches raw transactions idempotently using Akahu `_id` or deterministic fallback hashes.
- Posts only settled transactions to a strict double-entry SQLite ledger.
- Routes transactions through hot-reloadable YAML rules with NZFCC fallback and suspense safety.
- Exports hledger-compatible plain text accounting journals.
- Provides a local Streamlit BI dashboard for balance sheet and P&L reporting.

See `docs/architecture_design.md` for the Phase 1 architecture design and `docs/persona_frontend_information_design.md` for the persona-led frontend, information model, and ingestion design.

## Quick start

Everything is driven through one launcher, `./youinc`. One-time setup creates the
Python virtualenv, installs the package and frontend deps, writes `.env`, and
initializes the local SQLite ledger:

```sh
./youinc setup
```

Then use any of:

```sh
./youinc accounts                                  # list Akahu source accounts
./youinc sync --account-id acc_your_id --start-date 2026-06-01
./youinc reclassify
./youinc export-journal --output ledger.journal
./youinc frontend                                  # React dashboard on :3000
./youinc dashboard                                 # Streamlit BI dashboard
./youinc test                                      # run the test suite
./youinc cli --help                                # full CLI reference
./youinc help                                      # all launcher commands
```

`./youinc <cli-command>` forwards straight to the Python CLI. The launcher
auto-activates `.venv` and strips stale local proxy vars for you.

<details>
<summary>Manual equivalent (without the launcher)</summary>

```sh
python -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
python -m youinc_ledger.cli init-db
python -m youinc_ledger.cli accounts
python -m youinc_ledger.cli sync --account-id acc_your_akahu_account_id --start-date 2026-06-01
python -m youinc_ledger.cli reclassify
python -m youinc_ledger.cli export-journal --output ledger.journal
python -m streamlit run src/youinc_ledger/bi_reporting/dashboard.py
```

</details>

## TanStack Start frontend

A React frontend lives in `frontend/` and reads the same local SQLite ledger through TanStack Start server functions. It also exposes local live-ingestion controls and source-account mapping edits backed by `config/rules.yaml`. The frontend uses [pnpm](https://pnpm.io/).

The simplest way to run it is `./youinc frontend` from the repo root. To run it directly:

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
YOUINC_PYTHON=/absolute/path/to/python
AKAHU_CA_BUNDLE=/absolute/path/to/network-or-corporate-ca.pem
```

### Publishing the frontend publicly

This dashboard reads your real financial ledger, so it is gated behind a
**passkey (WebAuthn)** login — the whole app redirects to `/login` until you
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
to zero (a `Dockerfile` at the repo root packages the built frontend plus
the Python venv the CLI shell-outs need, backed by a Fly Volume for the
SQLite ledger and `rules.yaml` — no changes to the local-first architecture).

If `pnpm install` fails with `ECONNREFUSED` against `127.0.0.1:8080`, run it with local proxy variables unset (the `./youinc` launcher already does this for you):

```sh
env -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY -u https_proxy -u http_proxy -u all_proxy pnpm install
```

Akahu sync ignores generic `REQUESTS_CA_BUNDLE`, `SSL_CERT_FILE`, and `CURL_CA_BUNDLE` values so local mitmproxy/corporate cert settings do not silently affect banking ingestion. If live sync must run on a TLS-inspecting network, set `AKAHU_CA_BUNDLE` to that network's PEM CA bundle and restart the frontend.

If `pip install` fails with `ProxyError` against `127.0.0.1:8080`, your shell is configured to use a local proxy that is not running. Either start that proxy, or unset the proxy variables for this terminal session:

```sh
unset HTTPS_PROXY HTTP_PROXY ALL_PROXY https_proxy http_proxy all_proxy
pip install -e '.[dev]'
```

## Live Akahu sync

Set these in `.env` or as environment variables:

- `AKAHU_BASE_URL`
- `AKAHU_APP_TOKEN`
- `AKAHU_USER_TOKEN`

Then run:

```sh
python -m youinc_ledger.cli sync --account-id acc_bnz_your_account --start-date 2026-01-01 --end-date 2026-01-31
```

Use `--delta` for incremental sync using the stored last successful timestamp.

## Safety notes

- Pending transactions are cached but not posted by default.
- Every journal posting is validated so debits equal credits before commit.
- Unmatched transactions route to `Expenses:Uncategorized:Suspense`.
- Real credentials and local database files are ignored by git.
