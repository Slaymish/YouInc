// Build raster exports + a self-contained preview contact sheet from the SVG
// masters in brand/logos. The SVGs are already outlined, so no fonts needed.
//
//   node brand/tools/build-assets.mjs
//
// Outputs:
//   brand/logos/png/<name>@2x.png   transparent PNGs of every wordmark/lockup
//   brand/logos/png/favicon-*.png   icon rasters (16/32/180/512)
//   brand/preview.html              visual contact sheet (light + dark)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '../../frontend/package.json'));
const { chromium } = require('@playwright/test');

const logosDir = join(__dirname, '../logos');
const pngDir = join(logosDir, 'png');
mkdirSync(pngDir, { recursive: true });
const files = readdirSync(logosDir).filter((f) => f.endsWith('.svg')).sort();

const browser = await chromium.launch();

// ── PNG exports (transparent) ───────────────────────────────────────────
async function rasterize(svg, { height, width, scale = 2 }) {
  const page = await browser.newPage({ deviceScaleFactor: scale });
  const dim = width ? `width:${width}px` : `height:${height}px`;
  await page.setContent(`<!doctype html><style>*{margin:0}svg{display:block;${dim}}</style>${svg}`);
  const el = await page.$('svg');
  const buf = await el.screenshot({ omitBackground: true });
  await page.close();
  return buf;
}

for (const f of files) {
  const svg = readFileSync(join(logosDir, f), 'utf8');
  const base = f.replace('.svg', '');
  if (f.includes('icon')) {
    for (const s of [16, 32, 180, 512]) {
      writeFileSync(join(pngDir, `${base}-${s}.png`), await rasterize(svg, { width: s, scale: 1 }));
    }
  } else {
    const h = f.includes('lockup') ? 240 : 180;
    writeFileSync(join(pngDir, `${base}@2x.png`), await rasterize(svg, { height: h }));
  }
}
console.log('wrote PNGs to logos/png/');

// ── preview.html contact sheet ──────────────────────────────────────────
const swatches = [
  ['Ink', '#111111'], ['Paper', '#fbfbf9'], ['Accent', '#12a150'],
  ['Accent strong', '#0e8a44'], ['Negative', '#c0492f'], ['White', '#ffffff'],
];
// Which background(s) make each logo visible. Light/paper-filled marks
// (inverted, mono-white) only show on dark; icons carry their own tile so
// they show on both (with a hairline so a paper tile is visible on paper).
const bgFor = (f) => {
  if (f.includes('icon')) return ['light', 'dark'];
  if (f.includes('inverted') || f.includes('mono-white')) return ['dark'];
  return ['light'];
};
const cell = (f) => {
  const svg = readFileSync(join(logosDir, f), 'utf8');
  const tall = f.includes('lockup') ? 96 : f.includes('icon') ? 72 : 64;
  const isIcon = f.includes('icon');
  const rows = bgFor(f)
    .map((bg) => `<div class="row ${bg}"><div class="art${isIcon ? ' bordered' : ''}" style="height:${tall}px">${svg}</div></div>`)
    .join('');
  return `<div class="cell"><div class="lbl">${f}</div>${rows}</div>`;
};
const html = `<!doctype html><html><head><meta charset="utf-8"><title>YouInc — brand assets</title>
<style>
:root{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
body{margin:0;background:#f2f2ef;color:#111;padding:40px}
h1{font-size:22px;margin:0 0 4px}p.sub{margin:0 0 28px;color:#55534d}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#55534d;margin:32px 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px}
.cell{background:#fff;border:1px solid #e3e3dd;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.lbl{font-size:12px;font-weight:600;padding:8px 12px;background:#111;color:#fff}
.row{flex:1;display:flex;align-items:center;justify-content:center;padding:26px}
.light{background:#fbfbf9}.dark{background:#111}
.art svg{height:100%;width:auto;display:block}
.art.bordered{outline:1px solid rgba(128,128,128,.35);border-radius:8px}
.pal{display:flex;flex-wrap:wrap;gap:12px}
.pw{width:120px;border:1px solid #e3e3dd;border-radius:10px;overflow:hidden;background:#fff}
.pw .chip{height:60px}.pw .meta{padding:6px 8px;font-size:11px}
.pw .meta b{display:block}.pw .meta code{color:#55534d}
</style></head><body>
<h1>YouInc — brand assets</h1>
<p class="sub">Auto-generated from brand/logos/*.svg by tools/build-assets.mjs. Do not edit by hand.</p>
<h2>Palette</h2>
<div class="pal">${swatches.map(([n, h]) => `<div class="pw"><div class="chip" style="background:${h}"></div><div class="meta"><b>${n}</b><code>${h}</code></div></div>`).join('')}</div>
<h2>Logos</h2>
<div class="grid">${files.map(cell).join('')}</div>
</body></html>`;
writeFileSync(join(__dirname, '../preview.html'), html);
console.log('wrote preview.html');

await browser.close();
