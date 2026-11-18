#!/usr/bin/env node
/**
 * Validates src/data/cv.json and project frontmatter before the Astro build,
 * checks slug references, and prints the author-facing checklist of missing facts.
 * Astro re-validates the content collection with the full schema during `astro build`.
 *
 * Exit code 1 on any error. Warnings (missing facts, reminders) never fail the build.
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { cvSchema } from '../src/data/cv-schema.ts';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const errors = [];
const checklist = [];

const cvRaw = JSON.parse(await readFile(path.join(root, 'src/data/cv.json'), 'utf8'));
const parsed = cvSchema.safeParse(cvRaw);
if (!parsed.success) {
  for (const issue of parsed.error.issues) errors.push(`cv.json ${issue.path.join('.')}: ${issue.message}`);
}
const cv = parsed.success ? parsed.data : cvRaw;

// Never allow personal fields anywhere in the source data.
const forbidden = /"(phone|telephone|mobile|address|street|postcode|zip|birth|dateOfBirth|dob|birthday)"\s*:/i;
const cvText = JSON.stringify(cvRaw);
if (forbidden.test(cvText)) errors.push('cv.json contains a forbidden personal field (phone, address or date of birth).');

// Projects
const dir = path.join(root, 'src/content/projects');
const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
const projects = new Map();
const STATUSES = new Set(['published', 'draft']);
const DATE = /^\d{4}(-(0[1-9]|1[0-2]))?$/;
for (const file of files) {
  const slug = file.replace(/\.md$/, '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) errors.push(`${file}: slug must be lowercase-kebab-case`);
  if (projects.has(slug)) errors.push(`Duplicate slug: ${slug}`);
  const text = await readFile(path.join(dir, file), 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) {
    errors.push(`${file}: missing frontmatter`);
    continue;
  }
  const fm = parseYaml(m[1]);
  if (!STATUSES.has(fm.status)) errors.push(`${file}: status must be published or draft`);
  for (const k of ['start', 'end']) {
    if (fm[k] !== null && fm[k] !== undefined && !DATE.test(String(fm[k]))) errors.push(`${file}: ${k} must be YYYY-MM or YYYY`);
  }
  if (forbidden.test(JSON.stringify(fm))) errors.push(`${file}: forbidden personal field`);
  projects.set(slug, fm);
  if (fm.missing?.length) checklist.push({ where: `Project ${slug}${fm.status === 'draft' ? ' (draft)' : ''}`, items: fm.missing });
}

const published = new Set([...projects].filter(([, p]) => p.status === 'published').map(([s]) => s));
const refs = [
  ...(cv.selectedProjects ?? []).map((s) => ['selectedProjects', s]),
  ...(cv.skills ?? []).flatMap((g) => g.projects.map((s) => [`skills.${g.id}`, s])),
  ...(cv.experience ?? []).flatMap((x) => x.projects.map((s) => [`experience.${x.id}`, s])),
];
for (const [where, s] of refs) {
  if (!projects.has(s)) errors.push(`cv.json ${where}: unknown project slug "${s}"`);
  else if (!published.has(s)) errors.push(`cv.json ${where}: "${s}" is a draft and must not be linked`);
}
const expIds = new Set((cv.experience ?? []).map((x) => x.id));
if (expIds.size !== (cv.experience ?? []).length) errors.push('cv.json experience ids must be unique');

// Status/date consistency
for (const x of cv.experience ?? []) {
  if (x.status === 'upcoming' && !x.start) errors.push(`experience ${x.id}: upcoming entries need a start date`);
  if (x.status === 'completed' && x.contribution.length === 0) checklist.push({ where: `Experience ${x.id}`, items: ['Add a verified contribution line.'] });
  if (x.missing?.length) checklist.push({ where: `Experience ${x.id}`, items: x.missing });
}
for (const e of cv.education ?? []) if (e.missing?.length) checklist.push({ where: `Education ${e.school}`, items: e.missing });

const unsetLanguages = (cv.languages ?? []).filter((l) => !l.level).map((l) => l.name);
if (unsetLanguages.length) checklist.push({ where: 'Languages', items: [`Confirm proficiency levels for ${unsetLanguages.join(', ')} (levels stay hidden until set).`] });

const contactsUnset = Object.entries(cv.contacts ?? {}).filter(([, v]) => !v).map(([k]) => k);

// Reminders
const now = new Date();
const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const due = [];
for (const r of cv.editorial?.reminders ?? []) {
  const x = (cv.experience ?? []).find((e) => e.id === r.experienceId);
  if (r.experienceId && !x) errors.push(`reminder references unknown experience "${r.experienceId}"`);
  if (ym >= r.due && (!x || x.status === 'upcoming')) due.push(r.note);
}

// Report
const y = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
console.log('\nAuthor checklist (not published):');
for (const c of checklist) {
  console.log(`  ${c.where}`);
  for (const i of c.items) console.log(`    - ${i}`);
}
if (contactsUnset.length) console.log(y(`\nLaunch blocker: contacts not set (${contactsUnset.join(', ')}). They are omitted from the build until filled.`));
for (const b of cv.editorial?.launchBlockers ?? []) console.log(y(`Launch blocker: ${b}`));
for (const d of due) console.log(y(`\nREMINDER DUE: ${d}`));

if (errors.length) {
  console.error(red(`\n${errors.length} data error(s):`));
  for (const e of errors) console.error(red(`  - ${e}`));
  process.exit(1);
}
console.log(`\nData OK: ${published.size} published project(s), ${projects.size - published.size} draft(s).`);
