#!/usr/bin/env bash
# Fly.io entrypoint: the app is stateless (all persistence is Supabase), so this
# just launches the built Nitro server.
set -euo pipefail

echo "==> Starting frontend on port ${PORT:-3000}"
exec node /app/frontend/.output/server/index.mjs
