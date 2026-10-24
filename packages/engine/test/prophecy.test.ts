import { beforeEach, describe, expect, it } from 'vitest';
import {
  attack,
  buildStructure,
  getProphecy,
  isProphecyMet,
  performRitual,
  prophecyProgress,
  replaceProphecy,
  type GameState,
  type Player,
} from '../src';
import { give, grant, newGame, passTurn, rng } from './helpers';

let state: GameState;
let p0: Player;
let p1: Player;

beforeEach(() => {
  state = newGame();
  [p0, p1] = state.players as [Player, Player];
});

describe('delayed victory', () => {
  it('rulebook example: a Warlord who loses a Military structure before their next turn does not win', () => {
    p0.prophecyId = 'warlord';
    grant(state, p0, 'archer-tower');
    grant(state, p0, 'archer-tower');
    grant(state, p0, 'barracks');
    state.shop[0] = { id: 'shop-watchtower', structureId: 'watchtower' };
    give(p0, 'buildingMaterials', 7);
    give(p0, 'warriors', 3);
    expect(buildStructure(state, 'p0', 0).ok).toBe(true);
    expect(isProphecyMet(state, p0)).toBe(true);
    expect(state.winnerId).toBeNull(); // no instant win

    passTurn(state); // p0 ends turn
    give(p1, 'warriors', 3);
    expect(attack(state, 'p1', 'p0', p0.structures[0]!.id, rng()).ok).toBe(true);
    passTurn(state); // p1
    passTurn(state); // p2
    expect(state.turn.activePlayerId).toBe('p0');
    expect(state.winnerId).toBeNull();
    expect(state.turn.phase).toBe('action');
  });

  it('a Prophecy still met at the start of the player’s own turn wins automatically', () => {
    p0.prophecyId = 'city-founder';
    grant(state, p0, 'shipyard');
    grant(state, p0, 'shipyard');
    grant(state, p0, 'cedar-workshop');
    passTurn(state);
    expect(state.winnerId).toBeNull(); // p1's turn start: p1 has not met theirs
    passTurn(state);
    passTurn(state);
    expect(state.winnerId).toBe('p0');
    expect(state.turn.phase).toBe('gameOver');
    expect(state.log.at(-1)).toMatchObject({ type: 'gameWon', playerId: 'p0', data: { reason: 'prophecy' } });
  });

  it('only the first player to reach their turn start wins', () => {
    p1.prophecyId = 'great-builder';
    for (let i = 0; i < 7; i++) grant(state, p1, 'archer-tower');
    state.players[2]!.prophecyId = 'harvest-king';
    for (let i = 0; i < 4; i++) grant(state, state.players[2]!, 'farm');
    passTurn(state);
    expect(state.winnerId).toBe('p1');
    passTurn(state);
    expect(state.winnerId).toBe('p1');
    expect(state.turn.activePlayerId).toBe('p1');
  });

  it('refuses every action once the game is over', () => {
    state.winnerId = 'p0';
    state.turn.phase = 'gameOver';
    give(p0, 'grain', 4);
    expect(performRitual(state, 'p0', rng())).toEqual({ ok: false, error: 'The game is over' });
  });

  it('cumulative Prophecies stay met; conditional ones follow current holdings', () => {
    p0.prophecyId = 'high-priest';
    p0.counters.ritualsPerformed = 5;
    expect(isProphecyMet(state, p0)).toBe(true);

    p1.prophecyId = 'wealthy-merchant';
    give(p1, 'purpleDye', 8);
    expect(isProphecyMet(state, p1)).toBe(true);
    p1.inventory.purpleDye.pop();
    expect(isProphecyMet(state, p1)).toBe(false);
  });
});

describe('prophecyProgress', () => {
  it.each([
    ['conqueror', 2],
    ['great-builder', 3],
    ['high-priest', 4],
    ['warlord', 1],
    ['harvest-king', 1],
    ['merchant-prince', 0],
    ['city-founder', 1],
    ['wealthy-merchant', 6],
  ])('%s', (id, expected) => {
    p0.counters.structuresDestroyed = 2;
    p0.counters.ritualsPerformed = 4;
    grant(state, p0, 'barracks');
    grant(state, p0, 'farm');
    grant(state, p0, 'shipyard');
    give(p0, 'purpleDye', 6);
    expect(prophecyProgress(state, p0, getProphecy(state, id))).toBe(expected);
  });

  it('uses configured thresholds', () => {
    state.config.prophecies.find((p) => p.id === 'high-priest')!.threshold = 2;
    p0.prophecyId = 'high-priest';
    p0.counters.ritualsPerformed = 2;
    expect(isProphecyMet(state, p0)).toBe(true);
  });
});

describe('replaceProphecy', () => {
  it('draws an undealt Prophecy and keeps cumulative progress', () => {
    const old = p0.prophecyId;
    p0.counters.ritualsPerformed = 3;
    const undealt = [...state.prophecyDeck];
    expect(replaceProphecy(state, 'p0', rng()).ok).toBe(true);
    expect(undealt).toContain(p0.prophecyId);
    expect(state.prophecyDiscard).toEqual([old]);
    expect(p0.counters.ritualsPerformed).toBe(3);
  });

  it('reshuffles discarded Prophecies when none are undealt', () => {
    state.prophecyDiscard = [...state.prophecyDeck];
    state.prophecyDeck = [];
    expect(replaceProphecy(state, 'p0', rng()).ok).toBe(true);
  });

  it('fails when no Prophecy is available anywhere', () => {
    state.prophecyDeck = [];
    expect(replaceProphecy(state, 'p0', rng()).ok).toBe(false);
  });
});
