import type { Project } from './data';
import { formatRange } from './dates';

const CONTEXT_LABELS: Record<Project['data']['context'], string | null> = {
  client: 'Client project',
  internship: 'Internship',
  coursework: 'Coursework',
  independent: 'Independent project',
  other: null,
};

/** "Client project · Jan 2025 – Jun 2025" — only confirmed parts. */
export function projectMeta(p: Project): string[] {
  const parts: string[] = [];
  const ctx = CONTEXT_LABELS[p.data.context];
  if (ctx) parts.push(ctx);
  if (p.data.organisation && p.data.context !== 'coursework' && !p.data.title.includes(p.data.organisation)) {
    parts.push(p.data.organisation);
  }
  const range = formatRange(p.data.start, p.data.end, 'completed');
  if (range) parts.push(range);
  return parts;
}

/** Descriptive link text, e.g. "Read the VlotterQA case study". */
export function caseLinkText(p: Project): string {
  return `Read the ${p.data.title} case study`;
}

export function projectPath(p: Project): string {
  return `projects/${p.id}/`;
}
