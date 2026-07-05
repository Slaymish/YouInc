#!/usr/bin/env bash
# Fly.io entrypoint: the app is stateless (all persistence is Supabase), so this
# just launches the built Nitro server.
set -euo pipefail

echo "==> Starting frontend on port ${PORT:-3000}"
# Preload the reflect-metadata polyfill BEFORE the app: @simplewebauthn/server
# (→ @peculiar/x509 → tsyringe) runs import-time decorators that read the global
# `Reflect.getMetadata`, but the prod bundle tree-shakes the polyfill's
# side-effect import out. The polyfill is staged into .output by the build's
# `stage-reflect-polyfill` step. Without this, "Create a passkey" throws
# "Reflect.getMetadata is not a function".
exec node \
  --require /app/frontend/.output/server/reflect-metadata-polyfill.cjs \
  /app/frontend/.output/server/index.mjs
