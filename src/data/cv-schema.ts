import { z } from 'astro/zod';

/**
 * Schema for src/data/cv.json — the single source for identity, contacts,
 * experience, education, skills and languages. Used by Astro pages and by
 * scripts/validate-data.mjs (via Node type stripping).
 *
 * Deliberately has NO fields for phone, address or date of birth.
 */

/** "YYYY-MM" or "YYYY", or null when not yet confirmed. */
export const partialDate = z
  .string()
  .regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'Use YYYY-MM or YYYY')
  .nullable();

export const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase-kebab-case');

const httpsUrl = z.url({ protocol: /^https$/ });

export const experienceSchema = z.object({
  id: slug,
  /** Null when the employer is not yet confirmed for publication. */
  organisation: z.string().min(1).nullable(),
  role: z.string().min(1).nullable(),
  /** Location as a public, non-personal place (e.g. a country). */
  location: z.string().min(1).nullable(),
  status: z.enum(['completed', 'current', 'upcoming']),
  start: partialDate,
  end: partialDate,
  /** First-person, plain sentences. Only verified contributions. */
  contribution: z.array(z.string().min(1)),
  projects: z.array(slug),
  missing: z.array(z.string()),
});

export const cvSchema = z.object({
  identity: z.object({
    name: z.string().min(1),
    headline: z.string().min(1),
    lead: z.string().min(1),
  }),
  summary: z.string().min(1),
  about: z.array(z.string().min(1)).min(1),
  contacts: z.object({
    email: z.email().nullable(),
    linkedin: httpsUrl.nullable(),
    github: httpsUrl.nullable(),
  }),
  education: z.array(
    z.object({
      school: z.string().min(1),
      programme: z.string().min(1),
      note: z.string().min(1).nullable(),
      start: partialDate,
      end: partialDate,
      status: z.enum(['completed', 'current', 'upcoming']),
      missing: z.array(z.string()),
    }),
  ),
  experience: z.array(experienceSchema),
  skills: z.array(
    z.object({
      id: slug,
      label: z.string().min(1),
      items: z.array(z.string().min(1)).min(1),
      projects: z.array(slug),
    }),
  ),
  interests: z.array(z.string().min(1)),
  languages: z.array(
    z.object({
      name: z.string().min(1),
      /** Null until Rafet confirms a proficiency level. */
      level: z.string().min(1).nullable(),
    }),
  ),
  selectedProjects: z.array(slug).length(3),
  editorial: z.object({
    reminders: z.array(
      z.object({
        due: z.string().regex(/^\d{4}-\d{2}$/),
        experienceId: slug.nullable(),
        note: z.string().min(1),
      }),
    ),
    launchBlockers: z.array(z.string()),
  }),
});

export type Cv = z.infer<typeof cvSchema>;
export type Experience = z.infer<typeof experienceSchema>;
