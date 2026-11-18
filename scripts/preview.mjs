#!/usr/bin/env node
/** Serves the complete dist/ output (site + PDF) at the configured base. Run `npm run build` first. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDist, normaliseBase } from './lib/serve.mjs';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const base = normaliseBase(process.env.BASE_PATH);
const port = Number(process.env.PORT ?? 4322);
const server = await serveDist({ dist: path.join(root, 'dist'), base, port });
console.log(`Preview: ${server.url}  (Ctrl+C to stop)`);
const stop = async () => {
  await server.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
