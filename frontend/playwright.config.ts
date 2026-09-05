import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(),'youinc-browser-'));
export default defineConfig({
  testDir: './e2e', timeout: 30000, workers: 1,
  use: {trace: 'on-first-retry'},
  projects: [
    {name:'personal',testMatch:'local.spec.ts',use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:3100'}},
    {name:'demo',testMatch:/(landing|marketing-pages|demo)\.spec\.ts/,use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:3101'}},
  ],
  webServer: [
    {command:'node .output/server/index.mjs',url:'http://127.0.0.1:3100',timeout:30000,reuseExistingServer:false,
      env:{PORT:'3100',HOST:'127.0.0.1',NITRO_HOST:'127.0.0.1',YOUINC_DB_PATH:join(directory,'test.sqlite3'),YOUINC_DEMO:'0',AKAHU_APP_TOKEN:'',AKAHU_USER_TOKEN:''}},
    {command:'node .output/server/index.mjs',url:'http://127.0.0.1:3101',timeout:30000,reuseExistingServer:false,
      env:{PORT:'3101',HOST:'127.0.0.1',NITRO_HOST:'127.0.0.1',YOUINC_DB_PATH:join(directory,'must-not-open.sqlite3'),YOUINC_DEMO:'1'}},
  ],
});
