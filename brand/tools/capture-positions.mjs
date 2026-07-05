// Capture exact per-glyph x positions from a real browser so that generate.py
// can place OUTLINED glyphs pixel-identically (browser kerning + tracking are
// baked into the coordinates). Writes tools/positions.json.
//
//   node brand/tools/capture-positions.mjs
//
// Uses the frontend's Playwright + self-hosted Inter (@fontsource). Only needs
// re-running if you change the wordmark/tagline strings, weights, sizes, or
// letter-spacing below.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '../../frontend/package.json'));
const { chromium } = require('@playwright/test');

const fontDir = join(__dirname, '../../frontend/node_modules/@fontsource/inter/files');
const b64 = (f) => readFileSync(join(fontDir, f)).toString('base64');
const css = `
@font-face{font-family:Inter;font-weight:600;src:url(data:font/woff2;base64,${b64('inter-latin-600-normal.woff2')}) format('woff2');}
@font-face{font-family:Inter;font-weight:700;src:url(data:font/woff2;base64,${b64('inter-latin-700-normal.woff2')}) format('woff2');}`;

// The three type runs that make up every logo. Sizes are in the SVG user units
// used by generate.py; letter-spacing is in the same units (px at that size).
const runs = [
  { id: 'you', text: 'You', w: 700, size: 120, ls: -2 },
  { id: 'inc', text: 'INC', w: 700, size: 120, ls: 2 },
  { id: 'tag', text: 'RUN YOURSELF LIKE A COMPANY.', w: 600, size: 30, ls: 5 },
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="400">
${runs.map((r) => `<text id="${r.id}" x="0" y="200" font-family="Inter" font-weight="${r.w}" font-size="${r.size}" letter-spacing="${r.ls}">${r.text}</text>`).join('\n')}
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<!doctype html><style>${css}</style>${svg}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const out = await page.evaluate((runs) => {
  const res = {};
  for (const r of runs) {
    const el = document.getElementById(r.id);
    const chars = [];
    for (let i = 0; i < r.text.length; i++) chars.push({ ch: r.text[i], x: el.getStartPositionOfChar(i).x });
    res[r.id] = { text: r.text, weight: r.w, size: r.size, chars, total: el.getComputedTextLength() };
  }
  return res;
}, runs);
writeFileSync(join(__dirname, 'positions.json'), JSON.stringify(out, null, 2) + '\n');
console.log('wrote tools/positions.json');
await browser.close();
