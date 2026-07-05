import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Standalone test config: pure-logic unit tests run in a node environment and
// deliberately do not load the app's Vite plugins (React, TanStack Start). The
// `~` alias mirrors tsconfig's path mapping so a handful of server modules that
// import a `~/`-scoped value (e.g. webauthn.ts → marketing config) resolve; the
// heavier boundaries they touch (TanStack request context, @simplewebauthn) are
// mocked per-test.
export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
