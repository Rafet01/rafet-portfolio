import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { partialDate } from './data/cv-schema';

/**
 * Project case studies. Each Markdown file owns its verified facts.
 * Empty (null) sections are hidden on the public page and listed for the author.
 */
const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        /** One plain line: what the work was, or its verified result. */
        summary: z.string().min(1),
        organisation: z.string().min(1).nullable(),
        /** 'other' = context not yet confirmed; no context label is shown. */
        context: z.enum(['client', 'internship', 'coursework', 'independent', 'other']),
        /** Index grouping heading. */
        group: z.enum(['Client and internship work', 'SAP coursework', 'Independent']),
        status: z.enum(['published', 'draft']),
        /** Editorial order inside its group (lower first). */
        order: z.number().int().nonnegative(),
        /** Rafet's own role/contribution. Null until confirmed. */
        role: z.string().min(1).nullable(),
        /** Team credit line, when the work was a team deliverable. */
        team: z.string().min(1).nullable(),
        start: partialDate,
        end: partialDate,
        problem: z.string().min(1).nullable(),
        audience: z.string().min(1).nullable(),
        implementation: z.string().min(1).nullable(),
        decision: z.string().min(1).nullable(),
        result: z.string().min(1).nullable(),
        stack: z.array(z.object({ name: z.string().min(1), purpose: z.string().min(1).nullable() })),
        evidence: z.array(
          z.object({
            label: z.string().min(1),
            href: z.url({ protocol: /^https$/ }),
            /** Client material must be cleared for public use before it is shown. */
            cleared: z.boolean(),
          }),
        ),
        figure: z
          .discriminatedUnion('kind', [
            z.object({
              kind: z.literal('diagram'),
              /** Id of an inline SVG diagram in ProjectFigure.astro. */
              diagram: z.enum(['vlotterqa-layers']),
              caption: z.string().min(1),
              description: z.string().min(1),
              label: z.enum(['illustrative', 'reconstruction', 'synthetic', 'original']),
            }),
            z.object({
              kind: z.literal('image'),
              src: image(),
              alt: z.string().min(1),
              caption: z.string().min(1),
              description: z.string().min(1).nullable(),
              label: z.enum(['illustrative', 'reconstruction', 'synthetic', 'original']),
              cleared: z.literal(true),
            }),
          ])
          .nullable(),
        seoDescription: z.string().min(50).max(170),
        /** Author-facing list of facts still to confirm. Never rendered in production. */
        missing: z.array(z.string()),
      })
      .refine((p) => !(p.status === 'published' && p.context === 'independent' && p.result === null), {
        message: 'An independent project needs a documented result before it is published.',
      }),
});

export const collections = { projects };
