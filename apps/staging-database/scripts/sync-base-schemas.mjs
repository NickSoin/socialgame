import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(appRoot, '..', 'database', 'supabase', 'schemas');
const destinationRoot = resolve(appRoot, 'supabase', 'schemas', 'base');

await mkdir(destinationRoot, { recursive: true });
for (const file of ['init.sql', 'forecasts.sql']) {
  await copyFile(resolve(sourceRoot, file), resolve(destinationRoot, file));
}

process.stdout.write('Synced production declarative schemas into the staging build input.\n');
