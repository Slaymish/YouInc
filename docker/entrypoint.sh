#!/usr/bin/env bash
# Fly.io entrypoint: prepares the persistent volume (SQLite ledger + rules
# YAML) on first boot, then starts the built Nitro server. Volume state lives
# under /data so it survives Machine stop/start and scale-to-zero.
set -euo pipefail

DATA_DIR="${YOUINC_DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"

export YOUINC_PROJECT_ROOT="${YOUINC_PROJECT_ROOT:-/app}"
export YOUINC_PYTHON="${YOUINC_PYTHON:-/app/.venv/bin/python}"
export YOUINC_DB_PATH="${YOUINC_DB_PATH:-$DATA_DIR/youinc-ledger.sqlite3}"
export YOUINC_RULES_PATH="${YOUINC_RULES_PATH:-$DATA_DIR/rules.yaml}"

# Seed the volume with the image's default rules.yaml on first boot only.
# After that, the volume copy is authoritative — the frontend's Source
# Systems widget edits it directly, and re-seeding would clobber that.
if [[ ! -f "$YOUINC_RULES_PATH" ]]; then
  echo "==> Seeding $YOUINC_RULES_PATH from image default"
  cp "$YOUINC_PROJECT_ROOT/config/rules.yaml" "$YOUINC_RULES_PATH"
fi

if [[ ! -f "$YOUINC_DB_PATH" ]]; then
  echo "==> Initializing SQLite ledger at $YOUINC_DB_PATH"
  "$YOUINC_PYTHON" -m youinc_ledger.cli init-db --db-path "$YOUINC_DB_PATH"
fi

echo "==> Starting frontend on port ${PORT:-3000}"
exec node /app/frontend/.output/server/index.mjs
