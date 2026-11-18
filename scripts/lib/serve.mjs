/**
 * Minimal static server for dist/ mounted at the configured base path.
 * Used by the PDF generator, the verifier and `npm run preview`.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

export function normaliseBase(raw) {
  const b = raw === undefined ? '/rafet-portfolio' : raw || '/';
  return `/${b.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
}

/** @returns {Promise<{ url: string, close: () => Promise<void> }>} url includes the base, with trailing slash. */
export async function serveDist({ dist, base, port = 0 }) {
  const root = path.resolve(dist);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let pathname = decodeURIComponent(url.pathname);
      if (!pathname.startsWith(base) && pathname + '/' !== base) {
        res.writeHead(404).end('Outside base');
        return;
      }
      pathname = pathname.slice(base.length - 1) || '/';
      let file = path.join(root, pathname);
      if (!file.startsWith(root)) {
        res.writeHead(403).end();
        return;
      }
      let s = await stat(file).catch(() => null);
      if (s?.isDirectory()) {
        file = path.join(file, 'index.html');
        s = await stat(file).catch(() => null);
      }
      if (!s) {
        const notFound = await readFile(path.join(root, '404.html')).catch(() => 'Not found');
        res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end(notFound);
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  return {
    url: `http://127.0.0.1:${actualPort}${base}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
