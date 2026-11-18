import type { APIRoute } from 'astro';
import { absoluteUrl } from '../lib/url';

export const GET: APIRoute = ({ site }) => {
  const preview = import.meta.env.PUBLIC_PREVIEW === '1';
  const body = preview
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('sitemap-index.xml', site)}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
