import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'assets/raw/production/review/vertical-slice-01/preflight');
const destination = resolve(root, 'apps/client/public/assets/production/review/vertical-slice-01/preflight');

await rm(destination, { recursive: true, force: true });
await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true });
console.log('first-slice review preflight published to client public assets');
