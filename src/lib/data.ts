import { getCollection, type CollectionEntry } from 'astro:content';
import rawCv from '../data/cv.json';
import { cvSchema, type Cv, type Experience } from '../data/cv-schema';
import { formatPartialDate } from './dates';

export type Project = CollectionEntry<'projects'>;

/** Validated CV data. Throws at build time on any schema error. */
export const cv: Cv = cvSchema.parse(rawCv);

let published: Promise<Project[]> | undefined;

/**
 * Published projects, sorted by group then editorial order.
 * Also verifies that every slug referenced from cv.json points at a published project,
 * so a draft can never produce a dangling link.
 */
export function getPublishedProjects(): Promise<Project[]> {
  published ??= (async () => {
    const all = await getCollection('projects');
    const ids = new Set<string>();
    for (const p of all) {
      if (ids.has(p.id)) throw new Error(`Duplicate project slug: ${p.id}`);
      ids.add(p.id);
    }
    const live = all.filter((p) => p.data.status === 'published');
    const liveIds = new Set(live.map((p) => p.id));
    const refs: [string, string][] = [
      ...cv.selectedProjects.map((s) => ['selectedProjects', s] as [string, string]),
      ...cv.skills.flatMap((g) => g.projects.map((s) => [`skills.${g.id}`, s] as [string, string])),
      ...cv.experience.flatMap((x) => x.projects.map((s) => [`experience.${x.id}`, s] as [string, string])),
    ];
    for (const [where, s] of refs) {
      if (!liveIds.has(s)) throw new Error(`cv.json ${where} references "${s}", which is not a published project.`);
    }
    const groupOrder = ['Client and internship work', 'SAP coursework', 'Independent'];
    return live.sort(
      (a, b) =>
        groupOrder.indexOf(a.data.group) - groupOrder.indexOf(b.data.group) || a.data.order - b.data.order,
    );
  })();
  return published;
}

export async function getProjectsBySlugs(slugs: string[]): Promise<Project[]> {
  const all = await getPublishedProjects();
  return slugs.map((s) => {
    const p = all.find((x) => x.id === s);
    if (!p) throw new Error(`Unknown or unpublished project: ${s}`);
    return p;
  });
}

export const upcomingExperience: Experience[] = cv.experience.filter((x) => x.status === 'upcoming');
export const pastExperience: Experience[] = cv.experience.filter((x) => x.status !== 'upcoming');

/** "In February 2027 I start a data engineering internship in the Netherlands." composed from cv.json. */
export function upcomingSentence(x: Experience): string {
  const when = formatPartialDate(x.start, 'long');
  const what = (x.role ?? 'internship').replace(/^./, (c) => c.toLowerCase());
  const where = x.location ? ` in ${x.location}` : '';
  const at = x.organisation ? ` at ${x.organisation}` : '';
  return `${when ? `In ${when} ` : 'Soon '}I start a ${what}${at}${where}.`;
}

/** Public contact entries that are actually set. Unset ones are omitted everywhere. */
export function publicContacts(): { kind: 'email' | 'linkedin' | 'github'; label: string; href: string; text: string }[] {
  const out: { kind: 'email' | 'linkedin' | 'github'; label: string; href: string; text: string }[] = [];
  const { email, linkedin, github } = cv.contacts;
  if (email) out.push({ kind: 'email', label: 'Email', href: `mailto:${email}`, text: email });
  if (linkedin) out.push({ kind: 'linkedin', label: 'LinkedIn', href: linkedin, text: linkedin.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '') });
  if (github) out.push({ kind: 'github', label: 'GitHub', href: github, text: github.replace(/^https:\/\//, '').replace(/\/$/, '') });
  return out;
}
