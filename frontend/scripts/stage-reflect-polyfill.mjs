// Stage the reflect-metadata polyfill into the built server output so it can be
// preloaded (node --require) ahead of the app.
//
// Why: @simplewebauthn/server → @peculiar/x509 → tsyringe run decorators at
// import time that read the global `Reflect.getMetadata`. The prod Nitro/rollup
// build tree-shakes the reflect-metadata side-effect import out of the bundle
// (it is annotated @__PURE__), so the global is never installed and the passkey
// ceremonies throw "Reflect.getMetadata is not a function". Preloading the
// polyfill at the Node process level installs the global before any app chunk
// evaluates. (Dev is unaffected — Vite serves x509 unbundled.)
//
// The runtime image copies only `.output`, so the polyfill file must live there.
// This resolves the real reflect-metadata package (a direct dependency) and
// copies its single self-contained CJS entry next to the server bundle.
import { copyFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const dest = resolve(scriptDir, "../.output/server/reflect-metadata-polyfill.cjs");

if (!existsSync(resolve(scriptDir, "../.output/server"))) {
  throw new Error(
    "stage-reflect-polyfill: .output/server not found — run after `vite build`.",
  );
}

// reflect-metadata's package `main` is Reflect.js (the global-install CJS entry).
const src = require.resolve("reflect-metadata");
copyFileSync(src, dest);
console.log(`staged reflect-metadata polyfill → ${dest}`);
