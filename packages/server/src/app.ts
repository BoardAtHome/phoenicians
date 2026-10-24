import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { GameConfig } from '@phoenicians/engine';
import { createPhoenicians, type SetupData } from '@phoenicians/game';
import type { StorageAPI } from 'boardgame.io';
import { Server } from 'boardgame.io/server';
import serve from 'koa-static';
import { AdminAuth } from './auth';
import { ConfigError, type ConfigStore } from './configStore';

export interface AppOptions {
  store: ConfigStore;
  adminPassword: string;
  build: string;
  /** Built React client to serve; omitted in development, where Vite serves it. */
  clientDir?: string;
  origins?: string[];
  /** boardgame.io match storage; in-memory when omitted. */
  db?: StorageAPI.Async | StorageAPI.Sync;
}

type Ctx = { request: { headers: Record<string, string | string[] | undefined> }; req: NodeJS.ReadableStream; status: number; body: unknown };

async function readJson(ctx: Ctx): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of ctx.req) raw += chunk;
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function createApp({ store, adminPassword, build, clientDir, origins, db }: AppOptions) {
  const auth = new AdminAuth(adminPassword);

  const game = createPhoenicians({
    resolveConfig: (setupData: SetupData | undefined) => {
      if (auth.isDraftToken(setupData?.draftToken)) {
        return { config: store.draft.config, configVersion: `draft (based on v${store.draft.basedOn})`, build };
      }
      return { config: store.active.config, configVersion: `v${store.active.id}`, build };
    },
  });

  const server = Server({ games: [game], origins: origins ?? [/.*/], ...(db ? { db } : {}) });
  const router = server.router;

  const admin = (handler: (ctx: Ctx) => Promise<void>) => async (ctx: Ctx) => {
    if (!auth.isAdmin(ctx.request.headers.authorization as string | undefined)) {
      ctx.status = 401;
      ctx.body = { error: 'Admin password required' };
      return;
    }
    try {
      await handler(ctx);
    } catch (err) {
      if (!(err instanceof ConfigError)) throw err;
      ctx.status = 400;
      ctx.body = { error: err.message, details: err.details };
    }
  };

  const versionSummary = (v: (typeof store.versions)[number]) => ({
    id: v.id,
    note: v.note,
    createdAt: v.createdAt,
    build: v.build,
    changes: v.changes,
    active: v.id === store.active.id,
  });

  // Public: the rules in force and the changelog.
  router.get('/api/config', (ctx: Ctx) => {
    ctx.body = { version: store.active.id, build, config: store.active.config };
  });
  router.get('/api/versions', (ctx: Ctx) => {
    ctx.body = { build, versions: [...store.versions].reverse().map(versionSummary) };
  });

  router.post('/api/admin/login', async (ctx: Ctx) => {
    const { password } = await readJson(ctx);
    const token = typeof password === 'string' ? auth.login(password) : null;
    if (!token) {
      ctx.status = 401;
      ctx.body = { error: 'Wrong password' };
      return;
    }
    ctx.body = { token };
  });

  router.get('/api/admin/draft', admin(async (ctx) => {
    ctx.body = store.draft;
  }));
  router.put('/api/admin/draft', admin(async (ctx) => {
    const { config, note } = await readJson(ctx);
    const entry = await store.saveDraft(config as GameConfig, typeof note === 'string' ? note : '');
    ctx.body = { saved: entry, draft: store.draft };
  }));
  router.post('/api/admin/draft/reset', admin(async (ctx) => {
    const { versionId } = await readJson(ctx);
    await store.resetDraft(Number(versionId));
    ctx.body = { draft: store.draft };
  }));
  router.post('/api/admin/publish', admin(async (ctx) => {
    const { note } = await readJson(ctx);
    ctx.body = versionSummary(await store.publish(typeof note === 'string' ? note : ''));
  }));
  router.post('/api/admin/activate', admin(async (ctx) => {
    const { versionId } = await readJson(ctx);
    await store.activate(Number(versionId));
    ctx.body = { active: store.active.id };
  }));
  router.post('/api/admin/draft-token', admin(async (ctx) => {
    ctx.body = { token: auth.issueDraftToken() };
  }));

  if (clientDir && existsSync(clientDir)) {
    server.app.use(serve(clientDir));
    // Single-page app: unknown paths get index.html so match links work.
    const index = readFileSync(path.join(clientDir, 'index.html'));
    server.app.use(async (ctx, next) => {
      await next();
      if (ctx.status === 404 && ctx.method === 'GET' && !ctx.path.startsWith('/api') && !ctx.path.startsWith('/games')) {
        ctx.type = 'html';
        ctx.body = index;
      }
    });
  }

  return server;
}
