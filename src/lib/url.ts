/** Base-aware URL helpers. Every internal link, asset and download goes through withBase(). */
const rawBase: string = import.meta.env.BASE_URL;
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

export function withBase(path = ''): string {
  return base + path.replace(/^\/+/, '');
}

/** Absolute production URL for canonicals, Open Graph and structured data. */
export function absoluteUrl(path: string, site: URL | undefined): string {
  if (!site) throw new Error('astro.config.mjs must set `site` for canonical URLs.');
  return new URL(withBase(path), site).href;
}

export const CV_PDF_PATH = 'downloads/Rafet-Myumyun-CV.pdf';
export const CV_PDF_FILENAME = 'Rafet-Myumyun-CV.pdf';
