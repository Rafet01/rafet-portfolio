// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * Production origin and base path come from the environment so nothing is guessed.
 * - GitHub Actions sets them from actions/configure-pages (origin + base_path).
 * - Locally they default to a project-site layout: http://localhost:4321/rafet-portfolio/
 * Use BASE_PATH=/ for a user site or a custom domain served at root.
 */
const site = process.env.SITE_ORIGIN || 'http://localhost:4321';
const rawBase = process.env.BASE_PATH ?? '/rafet-portfolio';
const base = rawBase === '' ? '/' : rawBase;

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      // Drafts never get a route; 404 must not be listed.
      filter: (page) => !/\/404\/?$/.test(page),
    }),
  ],
});
