#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
const cwd = fileURLToPath(new URL('../frontend', import.meta.url));
if (!existsSync(`${cwd}/.output/server/index.mjs`)) { console.error('Run node scripts/setup.mjs first.'); process.exit(1); }
const child = spawn(process.execPath, ['--env-file-if-exists=.env', '--env-file-if-exists=.env.local', '.output/server/index.mjs'], {
  cwd, stdio:'inherit', env:{...process.env, HOST:'127.0.0.1', NITRO_HOST:'127.0.0.1', PORT:process.env.PORT || '3000'},
});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => {console.error(error.message); process.exitCode=1;});
child.on('exit', code => {process.exitCode=code ?? 0;});
