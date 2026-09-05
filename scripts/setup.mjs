#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../frontend', import.meta.url));
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error('YouInc requires Node.js 22.13 or newer.'); process.exit(1);
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const args of [
  ['exec','--yes','--package=pnpm@10.33.0','--','pnpm','install','--frozen-lockfile'],
  ['exec','--yes','--package=pnpm@10.33.0','--','pnpm','build'],
]) {
  const result = spawnSync(npm, args, {cwd, stdio:'inherit', shell: process.platform === 'win32'});
  if (result.error || result.status !== 0) { console.error('Setup stopped. Fix the error above and rerun setup.'); process.exit(1); }
}
console.log('Ready. Run: node scripts/start.mjs\nYour database is created automatically on first use.');
