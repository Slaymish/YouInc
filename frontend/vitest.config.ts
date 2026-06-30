import { defineConfig } from "vitest/config";

// Standalone test config: pure-logic unit tests run in a node environment and
// deliberately do not load the app's Vite plugins (React, TanStack Start). The
// modules under test only import types from server code, so no path alias is
// needed at runtime.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
