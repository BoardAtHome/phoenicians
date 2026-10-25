import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { ConfigStore, memoryPersistence } from './configStore';
import { createPool, PostgresMatchStore, postgresPersistence } from './postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const build = process.env.BUILD_VERSION ?? (JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }).version;
const port = Number(process.env.PORT ?? 8000);
const adminPassword = process.env.ADMIN_PASSWORD ?? '';
if (!adminPassword) console.warn('ADMIN_PASSWORD is not set: admin mode is disabled.');

const pool = process.env.DATABASE_URL ? createPool(process.env.DATABASE_URL) : null;
if (!pool) console.warn('DATABASE_URL is not set: configs and games will be lost on restart.');
const persistence = pool ? await postgresPersistence(pool) : memoryPersistence();
const db = pool ? new PostgresMatchStore(pool) : undefined;

const store = await ConfigStore.open(persistence, build);
const server = createApp({ store, adminPassword, build, db, clientDir: path.join(root, 'packages/client/dist') });
await server.run(port, () => console.log(`Phoenicians ${build} listening on :${port}`));
// Reaction windows left open when the server stopped or slept close as soon as it is back.
await server.windowTimers.trackAll();
