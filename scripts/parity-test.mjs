#!/usr/bin/env node
/**
 * One-edit parity test: changes one experience line in cv.json, rebuilds site + PDF,
 * asserts the new line appears in both dist/cv/index.html and the extracted PDF text,
 * then restores cv.json (always, even on failure) and rebuilds.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execSync, execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const cvPath = path.join(root, 'src/data/cv.json');
const original = await readFile(cvPath, 'utf8');
const marker = `Parity check line ${Date.now()}.`;
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

let ok = false;
try {
  const cv = JSON.parse(original);
  const target = cv.experience.find((x) => x.contribution.length > 0);
  if (!target) throw new Error('No experience entry with a contribution line to edit.');
  target.contribution[0] = marker;
  await writeFile(cvPath, JSON.stringify(cv, null, 2) + '\n');
  run('npx astro build --silent');
  run('node scripts/generate-cv.mjs');
  const html = await readFile(path.join(root, 'dist/cv/index.html'), 'utf8');
  const pdf = execFileSync('pdftotext', ['-layout', path.join(root, 'dist/downloads/Rafet-Myumyun-CV.pdf'), '-'], { encoding: 'utf8' });
  const inHtml = html.includes(marker);
  const inPdf = pdf.replace(/\s+/g, ' ').includes(marker);
  console.log(`HTML contains edited line: ${inHtml}`);
  console.log(`PDF contains edited line:  ${inPdf}`);
  ok = inHtml && inPdf;
} finally {
  await writeFile(cvPath, original);
  console.log('cv.json restored. Rebuilding original output…');
  run('npx astro build --silent');
  run('node scripts/generate-cv.mjs');
}
if (!ok) {
  console.error('Parity test FAILED');
  process.exit(1);
}
console.log('Parity test passed: one source edit changed both the web CV and the PDF.');
