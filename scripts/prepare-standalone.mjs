import { access, cp, mkdir, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const standalone = resolve(root, '.next/standalone');
await access(resolve(standalone, 'server.js'), constants.R_OK);

await rm(resolve(standalone, 'public'), { recursive: true, force: true });
await cp(resolve(root, 'public'), resolve(standalone, 'public'), { recursive: true });
await mkdir(resolve(standalone, '.next'), { recursive: true });
await rm(resolve(standalone, '.next/static'), { recursive: true, force: true });
await cp(resolve(root, '.next/static'), resolve(standalone, '.next/static'), { recursive: true });
console.info('Prepared .next/standalone with public and static assets.');
