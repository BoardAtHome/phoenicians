import type { AddressInfo } from 'node:net';
import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import type { State } from 'boardgame.io';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameState } from '@phoenicians/engine';
import { Phoenicians, type PlayerViewState } from '@phoenicians/game';
import { createApp } from '../src/app';
import { ConfigStore, memoryPersistence } from '../src/configStore';
import { HistoryStore, MemoryMatchStore } from '../src/matchStore';

const until = async (check: () => boolean) => {
  for (let i = 0; i < 150 && !check(); i++) await new Promise((r) => setTimeout(r, 20));
  expect(check()).toBe(true);
};

let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.reverse()) fn();
  cleanup = [];
});

describe('saved match state', () => {
  it('keeps no copy of earlier moves', async () => {
    const db = new MemoryMatchStore();
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
    const { matchID } = await post('/games/phoenicians/create', { numPlayers: 3, setupData: { names: ['Ana', 'Ben', 'Cy'], firstPlayer: '0' } });
    const { playerCredentials } = await post(`/games/phoenicians/${matchID}/join`, { playerID: '0', playerName: 'Ana' });
    const client = Client({ game: Phoenicians, numPlayers: 3, matchID, playerID: '0', credentials: playerCredentials, multiplayer: SocketIO({ server: base }) });
    client.start();
    cleanup.push(() => client.stop());
    await until(() => !!client.getState());

    const stateID = () => client.getState()!._stateID;
    client.moves.endActions!();
    await until(() => stateID() === 1);
    client.moves.draw!();
    await until(() => stateID() === 2);
    const { state } = await db.fetch(matchID, { state: true });
    expect((state as State<GameState>)._undo).toEqual([]);
  });

  it('drops the undo copies of matches saved before undo was turned off', async () => {
    const inner = new MemoryMatchStore();
    const history = new HistoryStore(inner);
    const state = { G: {}, ctx: {}, plugins: {}, _stateID: 1, _undo: [{ G: {} }, { G: {} }], _redo: [] } as unknown as State;
    await history.createMatch('m', { initialState: { ...state, _undo: [] }, metadata: {} as never });
    await history.setState('m', state);
    expect(((await inner.fetch('m', { state: true })).state as State)._undo).toEqual([]);
  });

  it('keeps one undo step for a move that changed nothing', async () => {
    const history = new HistoryStore(new MemoryMatchStore());
    const at = (id: number) => ({ G: { id }, ctx: {}, plugins: {}, _stateID: id, _undo: [], _redo: [] }) as unknown as State;
    await history.createMatch('m', { initialState: at(0), metadata: {} as never });
    await history.setState('m', at(1));
    await history.setState('m', at(1));
    await history.setState('m', at(1));
    expect(history.undoDepth('m')).toBe(1);
  });
});
