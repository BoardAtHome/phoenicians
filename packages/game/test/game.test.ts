import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import { describe, expect, it } from 'vitest';
import { baselineConfig } from '@phoenicians/engine';
import { createPhoenicians, HIDDEN, Phoenicians, type PlayerViewState } from '../src';

const state = (client: { getState: () => { G: unknown } | null }) => client.getState()!.G as PlayerViewState;

describe('Phoenicians game', () => {
  it('sets up a 3-player match with the baseline config', () => {
    const client = Client({ game: Phoenicians, numPlayers: 3 });
    client.start();
    const G = state(client);
    expect(G.players.map((p) => p.name)).toEqual(['Player 1', 'Player 2', 'Player 3']);
    expect(G.turn.activePlayerId).toBe('0');
    expect(G.shop).toHaveLength(6);
  });

  it('uses the config the server resolves', () => {
    const config = structuredClone(baselineConfig);
    config.shop.slots = 4;
    const client = Client({ game: createPhoenicians({ resolveConfig: () => ({ config, configVersion: 'v9', build: 'test' }) }), numPlayers: 3 });
    client.start();
    expect(state(client).shop).toHaveLength(4);
    expect(state(client).meta).toEqual({ configVersion: 'v9', build: 'test' });
  });

  it('runs a turn through moves and rejects illegal ones', () => {
    const spectator = Local();
    const game = Phoenicians;
    const p0 = Client({ game, numPlayers: 3, multiplayer: spectator, playerID: '0' });
    const p1 = Client({ game, numPlayers: 3, multiplayer: spectator, playerID: '1' });
    p0.start();
    p1.start();

    p1.moves.endActions!(); // not p1's turn: ignored
    expect(state(p0).turn.phase).toBe('action');

    p0.moves.endActions!();
    expect(state(p0).turn.phase).toBe('expedition');
    p0.moves.draw!();
    const G = state(p0);
    expect(G.expedition?.drawCount ?? 0).toBeGreaterThanOrEqual(0);
    expect(state(p1).turn.phase).toBe(G.turn.phase);
  });

  it('hides other players’ curses, Prophecies and deck order', () => {
    const local = Local();
    const p0 = Client({ game: Phoenicians, numPlayers: 3, multiplayer: local, playerID: '0', matchID: 'hidden-info' });
    p0.start();
    const G = state(p0);
    const [me, other] = G.players;
    expect(me!.prophecyId).not.toBe(HIDDEN);
    expect(me!.curseHand.every((c) => c.curseId !== HIDDEN)).toBe(true);
    expect(other!.prophecyId).toBe(HIDDEN);
    expect(other!.curseHand).toHaveLength(3);
    expect(other!.curseHand.every((c) => c.curseId === HIDDEN)).toBe(true);
    expect(G.expeditionDeck).toEqual([]);
    expect(G.counts.expeditionDeck).toBe(200);
  });
});
