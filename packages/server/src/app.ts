import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { eventsCsv, gameStats, summaryRow, toCsv, type GameConfig, type GameState } from '@phoenicians/engine';
import { createPhoenicians, type SetupData } from '@phoenicians/game';
import type { Server as ServerTypes, State, StorageAPI } from 'boardgame.io';
import { Server, SocketIO } from 'boardgame.io/server';
import serve from 'koa-static';
import { AdminAuth } from './auth';
import { ConfigError, type ConfigStore } from './configStore';
import { HistoryStore, MemoryMatchStore } from './matchStore';
import { WindowTimers } from './windowTimers';

export interface AppOptions {
  store: ConfigStore;
  adminPassword: string;
  build: string;
  /** Built React client to serve; omitted in development, where Vite serves it. */
  clientDir?: string;
  origins?: string[];
  /** boardgame.io match storage; in-memory when omitted. */
  db?: StorageAPI.Async;
}

type Ctx = {
  request: { headers: Record<string, string | string[] | undefined> };
  req: NodeJS.ReadableStream;
  status: number;
  body: unknown;
  params: Record<string, string>;
  type: string;
  set: (field: string, value: string) => void;
};

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

  const matches = new HistoryStore(db ?? new MemoryMatchStore());
  const transport = new SocketIO();
  const server = Server({ games: [game], origins: origins ?? [/.*/], db: matches, transport });
  // Reaction windows close on the server clock, whether or not any client is around to ask.
  const windowTimers = new WindowTimers(game, matches, transport);
  matches.onSave = (matchID, state) => windowTimers.track(matchID, state as State<GameState>);
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

  router.get('/api/versions/:id', (ctx: Ctx) => {
    const version = store.version(Number(ctx.params.id));
    if (!version) {
      ctx.status = 404;
      ctx.body = { error: 'No such version' };
      return;
    }
    ctx.body = { ...versionSummary(version), config: version.config };
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

  // Admin: matches, playtest stats and exports, and controls for stuck matches.
  type Match = { matchID: string; state: State<GameState>; metadata: ServerTypes.MatchData };
  async function loadMatch(matchID: string): Promise<Match | null> {
    const { state, metadata } = await matches.fetch(matchID, { state: true, metadata: true });
    return state && metadata ? { matchID, state: state as State<GameState>, metadata } : null;
  }
  async function allMatches(): Promise<Match[]> {
    const ids = await matches.listMatches({ gameName: game.name });
    const loaded = await Promise.all(ids.map(loadMatch));
    return loaded.filter((m): m is Match => m !== null).sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);
  }
  const matchSummary = ({ matchID, state, metadata }: Match) => {
    const G = state.G;
    return {
      matchID,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      players: G.players.map((p) => ({ name: p.name, eliminated: p.eliminated, connected: metadata.players[Number(p.id)]?.isConnected ?? false })),
      turn: G.turn.number,
      phase: G.turn.phase,
      activePlayer: G.players.find((p) => p.id === G.turn.activePlayerId)?.name,
      winner: G.players.find((p) => p.id === G.winnerId)?.name ?? null,
      configVersion: G.meta?.configVersion ?? 'unknown',
      build: G.meta?.build ?? 'unknown',
      undoDepth: matches.undoDepth(matchID),
    };
  };
  const withMatch = (handler: (ctx: Ctx, match: Match) => Promise<void> | void) =>
    admin(async (ctx) => {
      const match = await loadMatch(ctx.params.id ?? '');
      if (!match) {
        ctx.status = 404;
        ctx.body = { error: 'No such match' };
        return;
      }
      await handler(ctx, match);
    });
  const download = (ctx: Ctx, filename: string, type: string, body: string) => {
    ctx.type = type;
    ctx.set('content-disposition', `attachment; filename="${filename}"`);
    ctx.body = body;
  };
  /** Saves a state changed by the admin and pushes it to everyone connected to the match. */
  async function replaceState(match: Match, state: State<GameState>, { undo = false } = {}) {
    state._stateID = match.state._stateID + 1;
    state.deltalog = [];
    // An undo restores a state the history already holds; anything else becomes a new step that can itself be undone.
    await (undo ? matches.inner : matches).setState(match.matchID, state, []);
    windowTimers.track(match.matchID, state);
    await matches.setMetadata(match.matchID, { ...match.metadata, gameover: state.ctx.gameover, updatedAt: Date.now() });
    const pubSub = (server.transport as unknown as { pubSub?: { publish: (channel: string, payload: unknown) => void } }).pubSub;
    pubSub?.publish(`MATCH-${match.matchID}`, { type: 'update', args: [match.matchID, state] });
  }

  router.get('/api/admin/matches', admin(async (ctx) => {
    ctx.body = { matches: (await allMatches()).map(matchSummary) };
  }));
  router.get('/api/admin/matches/:id', withMatch((ctx, match) => {
    ctx.body = { summary: matchSummary(match), stats: gameStats(match.state.G), G: match.state.G };
  }));
  router.get('/api/admin/matches/:id/log.csv', withMatch((ctx, match) => {
    download(ctx, `phoenicians-${match.matchID}-log.csv`, 'text/csv', eventsCsv(match.state.G));
  }));
  router.get('/api/admin/matches/:id/export.json', withMatch((ctx, match) => {
    const body = { matchID: match.matchID, summary: matchSummary(match), stats: gameStats(match.state.G), log: match.state.G.log, config: match.state.G.config };
    download(ctx, `phoenicians-${match.matchID}.json`, 'application/json', JSON.stringify(body, null, 2));
  }));
  router.get('/api/admin/stats.csv', admin(async (ctx) => {
    const rows = (await allMatches()).map((m) => summaryRow(m.matchID, gameStats(m.state.G)));
    const columns = rows[0] ? Object.keys(rows[0]) : ['match'];
    download(ctx, 'phoenicians-games.csv', 'text/csv', toCsv([columns, ...rows.map((r) => columns.map((c) => r[c]))]));
  }));
  router.post('/api/admin/matches/:id/end', withMatch(async (ctx, match) => {
    const state = structuredClone(match.state);
    const G = state.G;
    if (G.turn.phase === 'gameOver') {
      ctx.status = 400;
      ctx.body = { error: 'That match is already over' };
      return;
    }
    Object.assign(G, { stack: [], window: null, pendingChoice: null });
    G.turn.phase = 'gameOver';
    G.log.push({ turn: G.turn.number, type: 'matchEnded', data: { by: 'admin' }, at: Date.now() });
    state.ctx.gameover = { endedByAdmin: true };
    await replaceState(match, state);
    ctx.body = { summary: matchSummary({ ...match, state }) };
  }));
  router.post('/api/admin/matches/:id/undo', withMatch(async (ctx, match) => {
    const previous = matches.popState(match.matchID) as State<GameState> | null;
    if (!previous) {
      ctx.status = 400;
      ctx.body = { error: 'Nothing to undo. Only actions since the server last started can be undone.' };
      return;
    }
    await replaceState(match, previous, { undo: true });
    ctx.body = { summary: matchSummary({ ...match, state: previous }) };
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

  return Object.assign(server, { windowTimers });
}
