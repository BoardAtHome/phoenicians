import type { AddressInfo } from 'node:net';
import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Phoenicians, type PlayerViewState } from '@phoenicians/game';
import { createApp } from '../src/app';
import { ConfigStore, memoryPersistence } from '../src/configStore';

let base = '';
let token = '';
let stop: () => void = () => {};

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
};
const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 20));
  expect(check()).toBe(true);
};

beforeAll(async () => {
  const store = await ConfigStore.open(memoryPersistence(), 'test');
  const server = createApp({ store, adminPassword: 'pw', build: 'test' });
  const { appServer } = await server.run(0);
  base = `http://localhost:${(appServer.address() as AddressInfo).port}`;
  stop = () => server.kill({ appServer, apiServer: undefined });
  token = (await call('POST', '/api/admin/login', { password: 'pw' })).json.token;
});
afterAll(() => stop());

describe('admin match tools', () => {
  it('lists matches, exports them, undoes the last action and ends a match', async () => {
    const created = await call('POST', '/games/phoenicians/create', { numPlayers: 3, setupData: { names: ['Ana', 'Ben', 'Cy'], firstPlayer: '0' } });
    const matchID = created.json.matchID as string;
    const joined = await call('POST', `/games/phoenicians/${matchID}/join`, { playerID: '0', playerName: 'Ana' });
    const client = Client({ game: Phoenicians, numPlayers: 3, matchID, playerID: '0', credentials: joined.json.playerCredentials, multiplayer: SocketIO({ server: base }) });
    client.start();
    const G = () => client.getState()?.G as PlayerViewState | undefined;
    await until(() => !!G());

    client.moves.endActions!();
    await until(() => G()!.turn.phase === 'expedition');

    const list = await call('GET', '/api/admin/matches');
    expect(list.json.matches[0]).toMatchObject({ matchID, turn: 1, phase: 'expedition', undoDepth: 1 });
    const detail = await call('GET', `/api/admin/matches/${matchID}`);
    expect(detail.json.stats.summary.players).toBe(3);
    const csv = await call('GET', `/api/admin/matches/${matchID}/log.csv`);
    expect(csv.text.split('\n')[0]).toBe('seq,time,turn,type,player,private,details');
    expect((await call('GET', '/api/admin/stats.csv')).text).toContain(matchID);
    expect((await call('GET', `/api/admin/matches/${matchID}/export.json`)).json.log.length).toBeGreaterThan(0);

    // Undo puts the match back in the action phase, and connected players see it.
    expect((await call('POST', `/api/admin/matches/${matchID}/undo`)).status).toBe(200);
    await until(() => G()!.turn.phase === 'action');
    expect((await call('POST', `/api/admin/matches/${matchID}/undo`)).status).toBe(400);

    // The match still plays after an undo.
    client.moves.endActions!();
    await until(() => G()!.turn.phase === 'expedition');

    expect((await call('POST', `/api/admin/matches/${matchID}/end`)).status).toBe(200);
    await until(() => G()!.turn.phase === 'gameOver');
    expect(client.getState()!.ctx.gameover).toEqual({ endedBy: 'admin' });
    expect((await call('GET', '/api/admin/matches')).json.matches[0]).toMatchObject({ matchID, phase: 'gameOver', endedBy: 'admin' });
    expect((await call('POST', `/api/admin/matches/${matchID}/end`)).status).toBe(400);
    // The log and stats are kept.
    expect((await call('GET', `/api/admin/matches/${matchID}`)).json.stats.summary).toMatchObject({ finished: true, reason: 'ended by admin' });
    client.stop();
  });

  it('ends the games that have gone a while without a move', async () => {
    const create = async () => (await call('POST', '/games/phoenicians/create', { numPlayers: 3, setupData: { names: ['Ana', 'Ben', 'Cy'], firstPlayer: '0' } })).json.matchID as string;
    const first = await create();
    await new Promise((r) => setTimeout(r, 400));
    const second = await create();
    // A cutoff between the two: only the first is idle long enough.
    const res = await call('POST', '/api/admin/matches/end-idle', { hours: 200 / 3_600_000 });
    expect(res.json.ended).toContain(first);
    expect(res.json.ended).not.toContain(second);
    const list = (await call('GET', '/api/admin/matches')).json.matches as { matchID: string; phase: string }[];
    expect(list.find((m) => m.matchID === first)?.phase).toBe('gameOver');
    expect(list.find((m) => m.matchID === second)?.phase).toBe('action');
    expect((await call('POST', '/api/admin/matches/end-idle', { hours: 'soon' })).status).toBe(400);
  });

  it('requires the admin password', async () => {
    const res = await fetch(`${base}/api/admin/matches`);
    expect(res.status).toBe(401);
  });
});

describe('idle games', () => {
  it('end by themselves after the configured time, and players see it', async () => {
    const store = await ConfigStore.open(memoryPersistence(), 'test');
    const server = createApp({ store, adminPassword: 'pw', build: 'test', idleHours: 1 / 3_600_000 }); // 1 ms
    const { appServer } = await server.run(0);
    const url = `http://localhost:${(appServer.address() as AddressInfo).port}`;
    try {
      const created = await fetch(`${url}/games/phoenicians/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ numPlayers: 3, setupData: { names: ['Ana', 'Ben', 'Cy'], firstPlayer: '0' } }),
      });
      const { matchID } = (await created.json()) as { matchID: string };
      const client = Client({ game: Phoenicians, numPlayers: 3, matchID, playerID: '0', multiplayer: SocketIO({ server: url }) });
      client.start();
      const G = () => client.getState()?.G as PlayerViewState | undefined;
      await until(() => !!G());
      await new Promise((r) => setTimeout(r, 5));
      server.idleGames.start();
      await until(() => G()?.turn.phase === 'gameOver');
      expect(client.getState()!.ctx.gameover).toEqual({ endedBy: 'idle' });
      client.stop();
    } finally {
      server.idleGames.stop();
      server.kill({ appServer, apiServer: undefined });
    }
  });
});
