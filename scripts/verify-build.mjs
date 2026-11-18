#!/usr/bin/env node
/**
 * Post-build checks on dist/: routes, drafts, links, metadata, privacy, PDF text, budgets.
 * Exit code 1 on any failure, so CI never uploads a broken artifact.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { normaliseBase } from './lib/serve.mjs';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const dist = path.join(root, 'dist');
const base = normaliseBase(process.env.BASE_PATH);
const PDF = path.join(dist, 'downloads', 'Rafet-Myumyun-CV.pdf');
const failures = [];
const notes = [];
const fail = (m) => failures.push(m);
const exists = (p) => stat(p).then(() => true, () => false);

// ---------- Source facts ----------
const cv = JSON.parse(await readFile(path.join(root, 'src/data/cv.json'), 'utf8'));
const projectDir = path.join(root, 'src/content/projects');
const projects = [];
for (const f of (await readdir(projectDir)).filter((f) => f.endsWith('.md'))) {
  const fm = parseYaml((await readFile(path.join(projectDir, f), 'utf8')).match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
  projects.push({ slug: f.replace(/\.md$/, ''), ...fm });
}
const published = projects.filter((p) => p.status === 'published');
const drafts = projects.filter((p) => p.status === 'draft');

// ---------- Collect HTML ----------
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}
const files = await walk(dist);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const pages = new Map();
for (const f of htmlFiles) pages.set(f, await readFile(f, 'utf8'));
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// ---------- 1. Routes ----------
const expected = ['index.html', 'projects/index.html', 'cv/index.html', '404.html', 'robots.txt', 'sitemap-index.xml', 'social/og.png', 'favicon.svg', 'downloads/Rafet-Myumyun-CV.pdf', ...published.map((p) => `projects/${p.slug}/index.html`)];
for (const r of expected) if (!(await exists(path.join(dist, r)))) fail(`Missing output: ${r}`);

// ---------- 2. Drafts leave no trace ----------
const textFiles = files.filter((f) => /\.(html|xml|txt|json)$/.test(f));
for (const d of drafts) {
  if (await exists(path.join(dist, 'projects', d.slug))) fail(`Draft has a route: ${d.slug}`);
  for (const f of textFiles) {
    if ((await readFile(f, 'utf8')).includes(d.slug)) fail(`Draft slug "${d.slug}" appears in ${path.relative(dist, f)}`);
  }
}

// ---------- 3. Sitemap ----------
const sitemapFiles = files.filter((f) => /sitemap-\d+\.xml$/.test(f));
const locs = (await Promise.all(sitemapFiles.map((f) => readFile(f, 'utf8')))).join('').match(/<loc>[^<]+<\/loc>/g) ?? [];
if (locs.some((l) => /404/.test(l))) fail('404 is listed in the sitemap');
if (locs.length !== 3 + published.length) fail(`Sitemap has ${locs.length} URLs, expected ${3 + published.length}`);

// ---------- 4. Internal links and fragments ----------
const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
function resolveTarget(urlPath) {
  const rel = decodeURIComponent(urlPath.slice(base.length));
  const target = path.join(dist, rel);
  return rel === '' || rel.endsWith('/') ? path.join(target, 'index.html') : target;
}
for (const [file, html] of pages) {
  const rel = path.relative(dist, file);
  const refs = [
    ...[...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/\ssrcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+/)[0])),
  ].map(decode);
  for (const ref of refs) {
    if (/^(https?:|mailto:|data:)/.test(ref)) {
      if (/127\.0\.0\.1/.test(ref)) fail(`${rel}: link to a local server: ${ref}`);
      continue;
    }
    if (ref.startsWith('#')) {
      if (ref.length > 1 && !idsOf(html).has(ref.slice(1))) fail(`${rel}: broken fragment ${ref}`);
      continue;
    }
    if (!ref.startsWith('/')) {
      fail(`${rel}: relative URL is not base-aware: ${ref}`);
      continue;
    }
    if (!ref.startsWith(base)) {
      fail(`${rel}: internal URL missing base ${base}: ${ref}`);
      continue;
    }
    const [p, frag] = ref.split('#');
    const target = resolveTarget(p);
    if (!(await exists(target))) {
      fail(`${rel}: broken link ${ref}`);
      continue;
    }
    if (frag && target.endsWith('.html')) {
      const targetHtml = pages.get(target) ?? (await readFile(target, 'utf8'));
      if (!idsOf(targetHtml).has(frag)) fail(`${rel}: broken fragment ${ref}`);
    }
  }
}

// ---------- 5. Metadata and structure ----------
const titles = new Map();
const descriptions = new Map();
for (const [file, html] of pages) {
  const rel = path.relative(dist, file);
  if (!/<html lang="en"/.test(html)) fail(`${rel}: missing lang="en"`);
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) fail(`${rel}: has ${h1} <h1> elements`);
  if (!/class="skip-link" href="#main"/.test(html) || !/id="main"/.test(html)) fail(`${rel}: missing skip link target`);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const desc = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  if (!title) fail(`${rel}: missing <title>`);
  if (!desc) fail(`${rel}: missing description`);
  if (titles.has(title)) fail(`${rel}: duplicate title with ${titles.get(title)}`);
  if (descriptions.has(desc)) fail(`${rel}: duplicate description with ${descriptions.get(desc)}`);
  titles.set(title, rel);
  descriptions.set(desc, rel);
  for (const tag of ['rel="canonical"', 'property="og:title"', 'property="og:image"', 'property="og:description"']) {
    if (!html.includes(tag)) fail(`${rel}: missing ${tag}`);
  }
  if (/Author checklist/.test(html)) fail(`${rel}: author notes leaked into the production build`);
  if (/<script(?![^>]*application\/ld\+json)[^>]*>/.test(html)) notes.push(`${rel}: contains a client script`);
}
const notFound = pages.get(path.join(dist, '404.html')) ?? '';
if (!/noindex/.test(notFound)) fail('404 must be noindex');

// ---------- 6. Privacy ----------
const privacy = [/tel:/i, /\bphone\b/i, /date of birth/i, /\bbirthday\b/i, /\+3[12]\s?\d/, /\bstraat\b|\bstreet\b/i];
for (const [file, html] of pages) {
  for (const re of privacy) if (re.test(html)) fail(`${path.relative(dist, file)}: matches privacy pattern ${re}`);
}

// ---------- 7. Structured data ----------
const allowedSameAs = new Set([cv.contacts.linkedin, cv.contacts.github].filter(Boolean));
for (const [file, html] of pages) {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const ld = JSON.parse(m[1]);
    for (const s of ld.sameAs ?? []) if (!allowedSameAs.has(s)) fail(`${path.relative(dist, file)}: unverified sameAs ${s}`);
    if (ld.email && ld.email !== `mailto:${cv.contacts.email}`) fail('JSON-LD email does not match cv.json');
  }
}

// ---------- 8. PDF text ----------
let pdfText = '';
try {
  pdfText = execFileSync('pdftotext', ['-layout', PDF, '-'], { encoding: 'utf8' });
} catch (err) {
  fail(`pdftotext unavailable or failed (${err.code ?? err.message}). Install poppler-utils.`);
}
if (pdfText) {
  const pageCount = (pdfText.match(/\f/g) ?? []).length;
  if (pageCount < 1 || pageCount > 2) fail(`PDF has ${pageCount} pages; aim for 1–2`);
  notes.push(`PDF pages: ${pageCount}`);
  const flat = pdfText.replace(/\s+/g, ' ');
  const inOrder = [cv.identity.name, 'Summary', 'Experience', 'Upcoming', 'Starting February 2027', 'Education', 'Projects', 'Skills', 'Languages'];
  let last = -1;
  for (const s of inOrder) {
    const i = flat.indexOf(s, last + 1);
    if (i === -1) fail(`PDF text missing "${s}"`);
    else if (i < last) fail(`PDF text "${s}" out of order`);
    else last = i;
  }
  for (const p of published) if (!flat.includes(p.title)) fail(`PDF missing project "${p.title}"`);
  for (const x of cv.experience) for (const c of x.contribution) if (!flat.includes(c)) fail(`PDF missing contribution "${c}"`);
  if (cv.contacts.email && !flat.includes(cv.contacts.email)) fail('PDF missing email');
  for (const u of allowedSameAs) if (!flat.includes(u.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, ''))) fail(`PDF missing ${u}`);
  for (const bad of ['Download CV', 'Skip to content', 'All projects', 'View projects', 'Author checklist', '127.0.0.1', 'localhost']) {
    if (flat.includes(bad)) fail(`PDF contains UI or local text "${bad}"`);
  }
  for (const re of privacy) if (re.test(pdfText)) fail(`PDF matches privacy pattern ${re}`);
}

// ---------- 9. Budgets (home page) ----------
const home = pages.get(path.join(dist, 'index.html')) ?? '';
const gz = async (p) => gzipSync(await readFile(p)).length;
let transfer = gzipSync(home).length;
let js = 0;
const homeAssets = [...home.matchAll(/(?:href|src)="(\/[^"]+\.(?:css|js|woff2|svg))"/g)].map((m) => m[1]);
const cssFiles = homeAssets.filter((a) => a.endsWith('.css'));
const fontsInCss = new Set();
for (const a of new Set(homeAssets)) {
  const f = resolveTarget(a);
  if (!(await exists(f))) continue;
  const size = a.endsWith('.woff2') ? (await stat(f)).size : await gz(f);
  transfer += size;
  if (a.endsWith('.js')) js += size;
}
for (const c of cssFiles) {
  const css = await readFile(resolveTarget(c), 'utf8');
  for (const m of css.matchAll(/url\((\/[^)]+\.woff2)\)/g)) if (!homeAssets.includes(m[1])) fontsInCss.add(m[1]);
}
for (const f of fontsInCss) {
  if (await exists(resolveTarget(f))) transfer += (await stat(resolveTarget(f))).size;
  else fail(`Font referenced in CSS is missing: ${f}`);
}
notes.push(`Home transfer (gzip, incl. all fonts): ${(transfer / 1024).toFixed(1)} KB (budget 250 KB)`);
notes.push(`Home first-party JS (gzip): ${(js / 1024).toFixed(1)} KB (budget 15 KB)`);
if (transfer > 250 * 1024) fail('Home page transfer budget exceeded');
if (js > 15 * 1024) fail('JS budget exceeded');

// ---------- Report ----------
for (const n of notes) console.log(`  · ${n}`);
if (failures.length) {
  console.error(`\n\x1b[31mverify-build: ${failures.length} failure(s)\x1b[0m`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\n\x1b[32mverify-build: all checks passed (${htmlFiles.length} HTML pages, base ${base}).\x1b[0m`);
