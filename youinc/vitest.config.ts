import { defineConfig } from 'vitest/config';

/**
 * The CLI is plain Node ESM and runs without a build step, so tests do too:
 * vitest transpiles the `.ts` imports the same way `node` strips them.
 */
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
