import type { AddressInfo } from 'node:net';
import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import type { State } from 'boardgame.io';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameState } from '@phoenicians/engine';
import { Phoenicians, type PlayerViewState } from '@phoenicians/game';
import { createApp } from '../src/app';
import { ConfigStore, memoryPersistence } from '../src/configStore';
import { MemoryMatchStore } from '../src/matchStore';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await sleep(20);
  expect(check()).toBe(true);
};

let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.reverse()) fn();
  cleanup = [];
});

async function start(db: MemoryMatchStore) {
  const store = await ConfigStore.open(memoryPersistence(), 'test');
  const server = createApp({ store, adminPassword: 'pw', build: 'test', db });
  const { appServer } = await server.run(0);
  cleanup.push(() => {
    server.windowTimers.stop();
    server.kill({ appServer, apiServer: undefined });
  });
  const base = `http://localhost:${(appServer.address() as AddressInfo).port}`;
  const post = async (path: string, body: unknown) =>
    (await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  const connect = (matchID: string, playerID: string, credentials: string) => {
    const client = Client({ game: Phoenicians, numPlayers: 3, matchID, playerID, credentials, multiplayer: SocketIO({ server: base }) });
    client.start();
    cleanup.push(() => client.stop());
    return { client, G: () => client.getState()?.G as PlayerViewState | undefined };
  };
  return { server, post, connect };
}

/** A 3-player match where both opponents hold a Curse that answers a draw, so every draw opens a window. */
async function matchWithReactions(db: MemoryMatchStore, post: Awaited<ReturnType<typeof start>>['post'], windowSeconds = 1) {
  const { matchID } = await post('/games/phoenicians/create', { numPlayers: 3, setupData: { names: ['Ana', 'Ben', 'Cy'], firstPlayer: '0' } });
  const credentials: string[] = [];
  for (const id of ['0', '1', '2']) credentials.push((await post(`/games/phoenicians/${matchID}/join`, { playerID: id, playerName: id })).playerCredentials);
  const { state } = await db.fetch(matchID, { state: true });
  const G = (state as State<GameState>).G;
  G.config.reactions.windowSeconds = windowSeconds;
  for (const p of G.players) if (p.id !== '0') p.curseHand = [{ id: `curse-${p.id}`, curseId: 'expedition-interruption' }];
  await db.setState(matchID, state!);
  return { matchID, credentials };
}

describe('reaction window timer', () => {
  it('closes an expired window on the server, with no client asking', async () => {
    const db = new MemoryMatchStore();
    const { post, connect } = await start(db);
    const { matchID, credentials } = await matchWithReactions(db, post);
    // Only the explorer is connected, and it never sends closeWindow: the opponents who may respond are offline.
    const ana = connect(matchID, '0', credentials[0]!);
    await until(() => !!ana.G());
    ana.client.moves.endActions!();
    await until(() => ana.G()!.turn.phase === 'expedition');
    ana.client.moves.draw!();
    await until(() => !!ana.G()!.window);
    const opened = Date.now();
    await until(() => ana.G()!.window === null);
    expect(Date.now() - opened).toBeGreaterThanOrEqual(900);
    expect(ana.G()!.log.some((e) => e.type === 'windowClosed' && e.data?.how === 'timer')).toBe(true);

    // The explorer can carry on drawing, and the next window closes the same way.
    ana.client.moves.draw!();
    await until(() => !!ana.G()!.window);
    await until(() => ana.G()!.window === null);
  });

  it('closes windows left open in storage once the server is back', async () => {
    const db = new MemoryMatchStore();
    const { post, server, connect } = await start(db);
    const { matchID, credentials } = await matchWithReactions(db, post);
    const ana = connect(matchID, '0', credentials[0]!);
    await until(() => !!ana.G());
    ana.client.moves.endActions!();
    await until(() => ana.G()!.turn.phase === 'expedition');
    // The server "restarts" with the window open: its timers are gone.
    server.windowTimers.stop();
    const { state } = await db.fetch(matchID, { state: true });
    const saved = state as State<GameState>;
    saved.G.window = { id: 99, entryId: 99, eligible: ['1'], passed: [], deadline: Date.now() - 1000, updatedAt: Date.now() - 2000, heldBy: null, remainingMs: 0 };
    saved.G.stack.push({ id: 99, kind: 'moment', playerId: '0', action: 'draw', canceled: false, windowDone: true });
    await db.setState(matchID, saved);

    await server.windowTimers.trackAll();
    await until(() => ana.G()?.turn.phase === 'expedition' && ana.G()!.log.some((e) => e.type === 'windowClosed'));
    const { state: after } = await db.fetch(matchID, { state: true });
    expect((after as State<GameState>).G.window).toBeNull();
    expect((after as State<GameState>).G.stack).toEqual([]);
  });
});
