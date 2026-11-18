#!/usr/bin/env node
/**
 * One-off generator for public/social/og.png (1200×630 share image).
 * Re-run with `npm run social` after changing the name or headline; commit the PNG.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const cv = JSON.parse(await readFile(path.join(root, 'src/data/cv.json'), 'utf8'));
const font = (f) => pathToFileURL(path.join(root, 'public/fonts', f)).href;

const html = `<!doctype html><html><head><style>
@font-face{font-family:SG;font-weight:700;src:url(${font('space-grotesk-latin-700-normal.woff2')})}
@font-face{font-family:SG;font-weight:500;src:url(${font('space-grotesk-latin-500-normal.woff2')})}
@font-face{font-family:IN;font-weight:400;src:url(${font('inter-latin-400-normal.woff2')})}
html,body{margin:0;width:1200px;height:630px;background:#101923;color:#f4f8fa}
.w{padding:80px 88px;display:flex;flex-direction:column;height:100%;box-sizing:border-box}
h1{font:700 88px/1 SG;letter-spacing:-.03em;margin:0 0 24px}
p{font:400 34px/1.35 IN;color:#b7c5cf;margin:0;max-width:900px}
svg{margin-top:auto}
text{font:500 22px SG;fill:#f4f8fa}
</style></head><body><div class="w">
<h1>${cv.identity.name}</h1><p>${cv.identity.headline}</p>
<svg width="760" height="150" viewBox="0 0 560 110">
<line x1="110" y1="45" x2="340" y2="45" stroke="#b7c5cf" stroke-width="2" stroke-dasharray="4 6"/>
<rect x="290" y="38" width="34" height="14" rx="3" fill="#6ee7be"/>
<rect x="10" y="5" width="100" height="80" rx="8" fill="#1a2735" stroke="#b7c5cf" stroke-width="2"/>
<rect x="28" y="22" width="64" height="10" rx="2" fill="none" stroke="#f4f8fa" stroke-width="2"/>
<rect x="28" y="40" width="64" height="10" rx="2" fill="none" stroke="#f4f8fa" stroke-width="2"/>
<rect x="28" y="58" width="64" height="10" rx="2" fill="none" stroke="#f4f8fa" stroke-width="2"/>
<rect x="170" y="5" width="100" height="80" rx="8" fill="#1a2735" stroke="#b7c5cf" stroke-width="2"/>
<path d="M196 47 L212 63 L244 27" fill="none" stroke="#f4f8fa" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="340" y="5" width="100" height="80" rx="8" fill="#1a2735" stroke="#b7c5cf" stroke-width="2"/>
<rect x="358" y="24" width="64" height="10" rx="2" fill="#b7c5cf"/><rect x="358" y="41" width="44" height="10" rx="2" fill="#b7c5cf"/><rect x="358" y="58" width="54" height="10" rx="2" fill="#b7c5cf"/>
<text x="60" y="108" text-anchor="middle">Source</text><text x="220" y="108" text-anchor="middle">Validate</text><text x="390" y="108" text-anchor="middle">Report</text>
</svg></div></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, 'public/social/og.png'), type: 'png' });
  console.log('Wrote public/social/og.png');
} finally {
  await browser.close();
}
