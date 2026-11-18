#!/usr/bin/env node
/**
 * Generates dist/downloads/Rafet-Myumyun-CV.pdf from the built /cv/ route.
 * Serves dist at the configured base, opens the CV in Playwright Chromium, waits for fonts,
 * prints with the page's own @page rules. Browser and server are closed even on error.
 */
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serveDist, normaliseBase } from './lib/serve.mjs';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const dist = path.join(root, 'dist');
const out = path.join(dist, 'downloads', 'Rafet-Myumyun-CV.pdf');
const base = normaliseBase(process.env.BASE_PATH);

let server;
let browser;
try {
  await stat(path.join(dist, 'cv', 'index.html'));
  server = await serveDist({ dist, base });
  browser = await chromium.launch();
  const page = await browser.newPage();
  const res = await page.goto(`${server.url}cv/`, { waitUntil: 'networkidle' });
  if (!res || !res.ok()) throw new Error(`CV route returned ${res?.status()}`);
  // Links in the PDF must point at the production site, never at this temporary server.
  // With no production origin configured (local build), relative links are reduced to plain text.
  await page.evaluate((origin) => {
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') ?? '';
      if (/^(https?:|mailto:)/.test(href)) continue;
      if (origin) a.setAttribute('href', new URL(href, origin).href);
      else a.removeAttribute('href');
    }
  }, process.env.SITE_ORIGIN || null);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  await mkdir(path.dirname(out), { recursive: true });
  await page.pdf({
    path: out,
    format: 'A4',
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    printBackground: false,
    tagged: true,
  });
  const { size } = await stat(out);
  console.log(`PDF written: ${path.relative(root, out)} (${(size / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error('PDF generation failed:', err);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
}
