import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { ConfigStore, memoryPersistence } from './configStore';
import { postgresPersistence } from './postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const build = process.env.BUILD_VERSION ?? (JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }).version;
const port = Number(process.env.PORT ?? 8000);
const adminPassword = process.env.ADMIN_PASSWORD ?? '';
if (!adminPassword) console.warn('ADMIN_PASSWORD is not set: admin mode is disabled.');

const persistence = process.env.DATABASE_URL ? await postgresPersistence(process.env.DATABASE_URL) : memoryPersistence();
if (!process.env.DATABASE_URL) console.warn('DATABASE_URL is not set: config changes will be lost on restart.');

const store = await ConfigStore.open(persistence, build);
const server = createApp({ store, adminPassword, build, clientDir: path.join(root, 'packages/client/dist') });
await server.run(port, () => console.log(`Phoenicians ${build} listening on :${port}`));
