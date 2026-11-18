# Rafet Myumyun — portfolio

English portfolio and CV for Rafet Myumyun, built with Astro (static output), plain CSS and no client JavaScript.
One data source feeds the home page, project pages, the web CV and the PDF CV.

- **Home** `/` · **Projects** `/projects/` · **Cases** `/projects/<slug>/` · **CV** `/cv/` · **PDF** `/downloads/Rafet-Myumyun-CV.pdf` · **404**
- Anchors: `/#about`, `/#experience`, `/#skills`, `/#contact`

## Requirements

- Node.js ≥ 22.23.4 (developed on 24), npm
- For the PDF: Playwright Chromium (`npx playwright install chromium`)
- For PDF checks: `pdftotext` (poppler-utils; included in Git for Windows' mingw64)

```powershell
npm ci
npx playwright install chromium
```

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at http://localhost:4321/rafet-portfolio/. Shows the **author checklist** boxes on pages with missing facts (never in production). |
| `npm run validate` | Validates `cv.json` and project frontmatter, checks slug references, prints the missing-facts checklist and due reminders. |
| `npm run build` | Full release build: validate → `astro check` → `astro build` → PDF → `verify-build`. Any failure exits non-zero. |
| `npm run preview` | Serves the complete `dist/` (site + PDF) at http://127.0.0.1:4322/rafet-portfolio/ |
| `npm run build:pdf` | Regenerates only the PDF from an existing `dist/` |
| `npm run test:parity` | Edits one experience line, rebuilds, checks it appears in both the web CV and the PDF, then restores the file. |
| `npm run social` | Regenerates `public/social/og.png` (share image) after a name/headline change. |

Base path and origin come from the environment: `BASE_PATH` (default `/rafet-portfolio`, use `/` for root) and `SITE_ORIGIN` (default `http://localhost:4321`).

```powershell
$env:BASE_PATH='/'; $env:SITE_ORIGIN='https://example.com'; npm run build
```

## Where to edit

| What | File |
| --- | --- |
| Name, headline, summary, about, contacts, education, experience, skills, languages, selected projects, reminders | `src/data/cv.json` (schema: `src/data/cv-schema.ts`) |
| A project case study | `src/content/projects/<slug>.md` (schema: `src/content.config.ts`) |
| Colours, type, spacing | `src/styles/tokens.css` |
| Print/PDF layout | `src/styles/print.css` |

Rules the build enforces:

- Dates are `"YYYY-MM"`, `"YYYY"` or `null`. Status is explicit (`completed` / `current` / `upcoming`; projects `published` / `draft`).
- A `null` field is hidden on the public site. Put what is still unknown in the `missing` list; it shows only in `npm run dev` and in `npm run validate`.
- `selectedProjects`, `skills[].projects` and `experience[].projects` must reference **published** slugs.
- Drafts get no route, no sitemap entry and no link. The verifier fails if a draft slug appears anywhere in `dist/`.
- There are no fields for phone, address or date of birth, and the validator rejects them.
- Contacts that are `null` are omitted from HTML, PDF and structured data.

### Publishing the independent data engineering project

`src/content/projects/data-engineering-pipeline.md` is a draft. When it has a reproducible run and a documented result: fill `result`, `stack`, `evidence`, set `status: published`, then add its slug to `selectedProjects` in `cv.json` to promote it on the home page.

### Internship status update (February 2027)

`cv.json` holds the internship once, with `status: "upcoming"` and `start: "2027-02"`. The home page reads “In February 2027 I start…”, and the CV labels it **Upcoming**.
`npm run validate` prints a **REMINDER DUE** line from February 2027 while the status is still `upcoming`.
When Rafet confirms the start:

1. Set `status` to `"current"` (and the employer in `organisation`, if it should be public).
2. Update the home support sentence: `upcomingSentence()` in `src/lib/data.ts` only covers upcoming entries. Add a present-tense line to `identity.lead`, e.g. “I’m a data engineering intern in the Netherlands.”
3. `npm run build` and deploy.

## Deploying to GitHub Pages

1. Create a GitHub repository (e.g. `rafet-portfolio`) and push `main`.
2. In **Settings → Pages**, set **Source: GitHub Actions**.
3. The workflow `.github/workflows/pages.yml` runs on every push to `main`. It installs dependencies, Chromium and poppler, runs the full `npm run build` (the PDF and all checks must pass), uploads `dist/`, and deploys with the official Pages actions.
   `actions/configure-pages` provides the real origin and base path, so `https://<user>.github.io/<repo>/` (project site) and `https://<user>.github.io/` (user site) both work without code changes.

### Custom domain (optional)

1. Verify the domain for your GitHub account (Settings → Pages → Verified domains).
2. In the repository's Pages settings, enter the custom domain.
3. At your DNS provider, add the records GitHub's documentation lists for an apex domain (A/AAAA) or a subdomain (CNAME to `<user>.github.io`).
4. Enable **Enforce HTTPS** once the certificate is issued.
5. Re-run the workflow. `configure-pages` then reports the custom origin and an empty base path, so canonicals, sitemap and the PDF links update.

Docs: [Astro on GitHub Pages](https://docs.astro.build/en/guides/deploy/github/), [Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

### Netlify (current live site)

Live at **https://rafet-myumyun.netlify.app/**, uploaded by hand with Netlify Drop. The GitHub Actions deploy is on hold while the GitHub account has a billing lock.

To publish an update:

```powershell
$env:BASE_PATH='/'; $env:SITE_ORIGIN='https://rafet-myumyun.netlify.app'; npm run build
```
```powershell
Remove-Item -Recurse -Force netlify-upload; Copy-Item -Recurse dist netlify-upload
```

Then, in Netlify: the site → **Deploys** → drag the `netlify-upload` folder onto the "Drag and drop your site output folder here" area.
Keep **Site configuration → Access & security → Visitor access** set to no protection, or visitors get a Netlify login page.

### Vercel alternative

Use the same tested `dist/`: build in GitHub Actions with `BASE_PATH=/` and `SITE_ORIGIN=https://<production-domain>` (Chromium is reliable there), then deploy `dist/` as a static output (e.g. `vercel deploy --prebuilt` or Vercel's static preset). See [Astro on Vercel](https://docs.astro.build/en/guides/deploy/vercel/).

### After any deployment

Check over HTTPS on the final domain: home, one deep case URL (e.g. `/projects/vlotterqa/`), `/cv/`, and the direct PDF URL. Note: on a project site, `robots.txt` lives under `/<repo>/` and crawlers ignore it; the sitemap and meta tags still apply.

Set `PUBLIC_PREVIEW=1` for preview deployments to add `noindex` and a disallow-all `robots.txt`.

## What the checks cover

`npm run build` ends with `scripts/verify-build.mjs`:

- every published route, the PDF, share image, sitemap and robots exist; drafts leave no trace
- every internal `href`/`src` is base-prefixed and resolves inside `dist/`, including `#fragments` on other pages
- one `<h1>` per page, `lang="en"`, skip link, unique titles and descriptions, canonical and Open Graph tags; 404 is `noindex` and not in the sitemap
- no phone, address or birth-date patterns in HTML or PDF; JSON-LD `sameAs` contains only the contacts in `cv.json`
- PDF text (via `pdftotext`) has the name, headings in reading order, the upcoming label and date, every project and contribution, any set contacts, and no UI text (“Download CV”, “Skip to content”) or local URLs; 1–2 pages
- home transfer ≤ 250 KB gzip including fonts, first-party JS ≤ 15 KB

## Accessibility and performance status

Checked locally on 2026-11-18 against the built site:

- Contrast (WCAG AA): lowest text pair is teal on paper, 6.5:1. All others ≥ 7:1.
- 320 px: no horizontal scroll on home, projects, case and CV pages. Header wraps to two lines on narrow screens.
- Keyboard: skip link first, visible 3 px focus ring on dark and light surfaces.
- Reduced motion: the hero record is static at its end position; all transitions off. Normal motion: one 1.6 s ease-out run.
- No client JavaScript, so every route, the contact section and the PDF work with JavaScript disabled.
- Home: ≈ 80 KB gzip including all four font files; 0 KB JS.
- **Not yet run:** Lighthouse (median of three cold mobile runs) and field Core Web Vitals. Run Lighthouse on the production URL after the first deploy and record conditions and results here.

## Author checklist (before launch)

Launch blockers:

- [ ] Fill and verify `contacts.email`, `contacts.linkedin`, `contacts.github` in `cv.json`
- [ ] Choose the repository name (or custom domain); first deploy; check URLs over HTTPS

Facts that most improve the first release (full list: `npm run validate`):

- [ ] VlotterQA: client name or “unnamed”, dates, the QA problem and audience, one decision Rafet made, a publishable result, cleared screenshots or a labelled reconstruction
- [ ] Christelijke Mutualiteit: dates, role, and the **verified** workflow (no diagram until then)
- [ ] Wolf Oil: context, stack, audience and question, Rafet’s responsibilities
- [ ] Flexso: context (school project / internship), role, dates
- [ ] SAP coursework: what was built and Rafet’s part in each
- [ ] Language proficiency levels (Dutch, Turkish, English, Bulgarian)
- [ ] Official English school name, or keep “AP Hogeschool Antwerpen”
- [ ] Education dates
- [ ] February 2027: confirm the internship start and update tense

## Fonts

Space Grotesk and Inter (Latin subset, WOFF2) from Google Fonts via Fontsource, self-hosted in `public/fonts/` under the SIL Open Font License (`*-OFL.txt`).
