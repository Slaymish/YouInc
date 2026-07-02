# Deploying to Fly.io

This app is local-first: the frontend opens a SQLite file directly and shells
out to the Python CLI for sync/reclassify/account-mapping. Fly.io Machines
support both an ephemeral scale-to-zero compute layer *and* a persistent
volume attached to the same container, so this deployment keeps the existing
architecture unchanged — no database migration, no rewrite.

## What gets deployed

One Docker image (see `Dockerfile`) containing:

- The built TanStack Start frontend (`frontend/.output`), including the
  traced `better-sqlite3` native module.
- A Python venv at `/app/.venv` with the `youinc_ledger` package installed,
  used by the frontend's `execFile` shell-outs.

A single Fly Machine runs this image, with a **Fly Volume mounted at
`/data`** holding the SQLite ledger and `config/rules.yaml`. On first boot,
`docker/entrypoint.sh` seeds `/data/rules.yaml` from the image default and
runs `init-db` if the ledger doesn't exist yet. On every later boot it reuses
whatever is already on the volume.

`fly.toml` sets `min_machines_running = 0` with `auto_stop_machines = "stop"`
/ `auto_start_machines = true` — the Machine suspends when idle and Fly Proxy
starts it again on the next request (roughly a second of cold-start latency,
plus this app's ~200ms boot). You only pay for compute while it's actually
serving a request, plus a few cents/month for the volume.

## One-time setup

Install `flyctl` and sign in:

```sh
brew install flyctl   # or see https://fly.io/docs/flyctl/install/
fly auth login
```

From the repo root:

```sh
# Creates the app on Fly (uses the existing fly.toml — update `app =` to a
# globally-unique name first if "youinc-ledger" is taken).
fly launch --no-deploy

# Create the persistent volume. Must be in the same region as primary_region
# in fly.toml (default: syd). 1GB is generous for a personal ledger.
fly volumes create youinc_data --region syd --size 1

# Set the Basic Auth credentials (see frontend/src/start.ts) as secrets —
# never commit these. Required before your first deploy, or the app will be
# reachable by anyone with the URL.
fly secrets set \
  YOUINC_BASIC_AUTH_USERNAME=yourusername \
  YOUINC_BASIC_AUTH_PASSWORD='use a long random password here'

# If you want live Akahu sync from the deployed app, also set:
fly secrets set \
  AKAHU_APP_TOKEN=... \
  AKAHU_USER_TOKEN=...

fly deploy
```

Fly automatically provisions HTTPS (`force_https = true` in `fly.toml`), so
Basic Auth credentials are never sent over plain HTTP.

## Redeploying

```sh
fly deploy
```

This rebuilds the Docker image and does a rolling update. The volume (and
everything on it — ledger, rules.yaml) is untouched by deploys; only the
container image changes.

## Continuous deployment (GitHub Actions)

`.github/workflows/ci.yml` runs the Python test suite and the frontend build
+ tests on every push/PR, then deploys to Fly.io automatically on every push
to `main` once both test jobs pass.

One-time setup:

```sh
# Scoped deploy-only token, from the repo root (needs an existing fly.toml).
fly tokens create deploy -x 999999h
```

Copy the full output, including the leading `FlyV1 ` prefix, then in the
GitHub repo: **Settings → Secrets and variables → Actions → New repository
secret**, name it `FLY_API_TOKEN`, and paste the token as the value.

After that, every push to `main` that passes tests triggers `flyctl deploy
--remote-only` (builds on Fly's remote builder, so the GitHub runner doesn't
need Docker). Watch progress under the repo's **Actions** tab, or with `fly
logs` once the deploy starts.

To deploy manually without waiting for CI (e.g. a hotfix), you can still run
`fly deploy` from your own machine at any time — it uses your local `flyctl`
auth session, not the CI secret.

## Day-to-day operations

- **Logs**: `fly logs`
- **SSH into the running Machine** (e.g. to run a one-off CLI command):
  `fly ssh console`, then `cd /app && .venv/bin/python -m youinc_ledger.cli --help`
- **Check volume usage**: `fly ssh console -C "df -h /data"`
- **Manually wake the Machine**: just hit the URL — `auto_start_machines`
  handles it.
- **Force-stop to save cost immediately**: `fly scale count 0` (redeploy or
  `fly scale count 1` to bring it back).

## Backing up the ledger

The volume has scheduled daily snapshots enabled by default (5-day
retention). For an off-Fly backup, use `fly ssh sftp` or `fly ssh console` to
pull `/data/youinc-ledger.sqlite3` and `/data/rules.yaml` periodically, or
export the hledger journal (`./youinc export-journal`) and commit it, as
you're already doing locally.

## Updating the Basic Auth credentials

```sh
fly secrets set YOUINC_BASIC_AUTH_PASSWORD='new password'
```

Secrets trigger a Machine restart automatically.

## Costs (approximate, check fly.io/docs/about/pricing for current rates)

- Compute: billed per-second while the Machine is running. A `shared-cpu-1x`
  Machine (as configured) idling most of the day and only waking for your
  own visits costs a small fraction of an always-on Machine.
- Volume: ~$0.15/GB/month regardless of Machine state (1GB ≈ USD 0.15/mo).
- No charge while the Machine is stopped/suspended other than the volume.
