// Plays a 6-player match against a real server and reports, per move, how long the reply took
// and how many bytes each client received. Usage: DATABASE_URL=... npx tsx bench/load.ts
import type { AddressInfo } from 'node:net';
import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import type { PlayerViewState } from '@phoenicians/game';
import { createApp } from '../src/app';
import { ConfigStore, memoryPersistence } from '../src/configStore';
import { MemoryMatchStore } from '../src/matchStore';
import { createPool, PostgresMatchStore } from '../src/postgres';

const PLAYERS = Number(process.env.PLAYERS ?? 6);
const MOVES = Number(process.env.MOVES ?? 150);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pool = process.env.DATABASE_URL ? createPool(process.env.DATABASE_URL) : null;
if (pool) await pool.query('DROP TABLE IF EXISTS phoenicians_matches');
const db = pool ? new PostgresMatchStore(pool) : new MemoryMatchStore();
const store = await ConfigStore.open(memoryPersistence(), 'bench');
const server = createApp({ store, adminPassword: 'pw', build: 'bench', db });
const { appServer } = await server.run(0);
const base = `http://localhost:${(appServer.address() as AddressInfo).port}`;
const post = async (path: string, body: unknown) =>
  (await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();

const names = Array.from({ length: PLAYERS }, (_, i) => `P${i}`);
const { matchID } = await post('/games/phoenicians/create', { numPlayers: PLAYERS, setupData: { names, firstPlayer: '0' } });
const clients = [];
for (let i = 0; i < PLAYERS; i++) {
  const { playerCredentials } = await post(`/games/phoenicians/${matchID}/join`, { playerID: String(i), playerName: names[i] });
  const client = Client({ game: (await import('@phoenicians/game')).Phoenicians, numPlayers: PLAYERS, matchID, playerID: String(i), credentials: playerCredentials, multiplayer: SocketIO({ server: base }) });
  client.start();
  clients.push(client);
}
let bytes = 0;
let lastSize = 0;
await sleep(500);
for (const c of clients) {
  const socket = (c as unknown as { transport: { socket: { onAny: (fn: (ev: string, ...a: unknown[]) => void) => void } } }).transport.socket;
  socket.onAny((_ev, ...args) => {
    const n = JSON.stringify(args).length;
    bytes += n;
    lastSize = n;
  });
}
// Lobby polling, as the match page does every 3s per player.
const poll = setInterval(() => {
  for (let i = 0; i < PLAYERS; i++) void fetch(`${base}/games/phoenicians/${matchID}`);
}, 3000);

const G = (i: number) => clients[i]!.getState()!.G as PlayerViewState;
const stateID = () => clients[0]!.getState()!._stateID;
let draws = 0;
console.log('move,draws,ms,bytesAllClients,lastMsgBytes,gLogEntries');
for (let m = 0; m < MOVES; m++) {
  const g = G(0);
  if (g.turn.phase === 'gameOver') break;
  const before = stateID();
  bytes = 0;
  const t0 = performance.now();
  let label = '';
  const activeId = g.turn.activePlayerId;
  const ac = clients[Number(activeId)]!;
  if (g.window) {
    label = 'pass';
    for (let i = 0; i < PLAYERS; i++) {
      const w = G(i).window;
      if (w && w.eligible.includes(String(i)) && !w.passed.includes(String(i))) clients[i]!.moves.pass!(w.id);
    }
    // Nobody eligible: let the server timer close it.
  } else if (g.pendingChoice) {
    const pc = g.pendingChoice;
    const c = clients[Number(pc.playerId)]!;
    if (pc.kind === 'discardInventory') {
      const me = G(Number(pc.playerId)).players.find((p) => p.id === pc.playerId)!;
      let left = pc.count;
      const sel: Record<string, number> = {};
      for (const [res, cards] of Object.entries(me.inventory)) {
        const take = Math.min(left, (cards as unknown[]).length);
        sel[res] = take;
        left -= take;
      }
      label = 'discard';
      c.moves.chooseDiscard!(sel);
    } else if (pc.kind === 'arrangeExpedition') {
      label = 'arrange';
      c.moves.arrangeExpedition!(G(Number(pc.playerId)).foresight.map((x) => x.id));
    } else {
      label = 'forced';
      const victim = g.players.find((p) => p.id === pc.targetId)!;
      c.moves.forcedAttack!(victim.structures[0]!.id);
    }
  } else if (g.turn.phase === 'action') {
    label = 'endActions';
    ac.moves.endActions!();
  } else {
    const e = g.expedition;
    const canStop = !!e && e.drawCount > 0 && e.lastDrawWasResource && e.mustDraw === 0;
    if (canStop && e!.drawCount >= 3) {
      label = 'stop';
      ac.moves.stopExpedition!();
    } else {
      label = 'draw';
      draws++;
      ac.moves.draw!();
    }
  }
  const end = Date.now() + 15000;
  while (stateID() === before && Date.now() < end) await sleep(2);
  const ms = performance.now() - t0;
  await sleep(30);
  console.log(`${m} ${label},${draws},${ms.toFixed(0)},${bytes},${lastSize},${G(0).log.length}`);
}
clearInterval(poll);
if (pool) {
  const { rows } = await pool.query("SELECT pg_column_size(state) s, pg_column_size(log) l, jsonb_array_length(log) n, length(state::text) st, length(log::text) lt FROM phoenicians_matches");
  console.log('db row', rows[0]);
}
for (const c of clients) c.stop();
await sleep(500);
server.windowTimers.stop();
server.kill({ appServer, apiServer: undefined });
await pool?.end();
process.exit(0);
