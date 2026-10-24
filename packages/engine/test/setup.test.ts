import { describe, expect, it } from 'vitest';
import { baselineConfig, createRng, inventorySize, setupGame, SetupError } from '../src';
import { countAllExpeditionCards, newGame } from './helpers';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

describe('setupGame', () => {
  it.each([3, 7])('deals a %i-player game', (n) => {
    const state = newGame(n);
    expect(state.players).toHaveLength(n);
    expect(new Set(state.players.map((p) => p.prophecyId)).size).toBe(n);
    expect(state.prophecyDeck).toHaveLength(8 - n);
    for (const p of state.players) {
      expect(p.curseHand).toHaveLength(3);
      expect(inventorySize(p.inventory)).toBe(0);
      expect(p.structures).toHaveLength(0);
    }
    expect(state.curseDeck).toHaveLength(40 - 3 * n);
  });

  it('fills the six shop slots from 24 buildings', () => {
    const state = newGame();
    expect(state.shop).toHaveLength(6);
    expect(state.shop.every((s) => s !== null)).toBe(true);
    expect(state.buildingDeck).toHaveLength(18);
  });

  it('builds a shuffled 200-card Expedition deck', () => {
    const state = newGame();
    expect(state.expeditionDeck).toHaveLength(200);
    expect(countAllExpeditionCards(state)).toBe(200);
  });

  it('starts with the chosen first player and keeps seat order', () => {
    const state = setupGame(baselineConfig, seats(4), 'p2', createRng(1));
    expect(state.turn).toEqual({ number: 1, activePlayerId: 'p2', phase: 'action', extraExpeditions: 0 });
    expect(state.players.map((p) => p.id)).toEqual(['p2', 'p3', 'p0', 'p1']);
  });

  it('is deterministic for a seed', () => {
    expect(newGame(4, 7)).toEqual(newGame(4, 7));
    expect(newGame(4, 7).expeditionDeck).not.toEqual(newGame(4, 8).expeditionDeck);
  });

  it.each([2, 8])('rejects %i players', (n) => {
    expect(() => setupGame(baselineConfig, seats(n), 'p0', createRng(1))).toThrow(SetupError);
  });

  it('takes starting resources out of the deck', () => {
    const config = structuredClone(baselineConfig);
    config.setup.startingResources.grain = 2;
    const state = setupGame(config, seats(3), 'p0', createRng(1));
    expect(state.players.every((p) => p.inventory.grain.length === 2)).toBe(true);
    expect(state.expeditionDeck).toHaveLength(194);
    expect(countAllExpeditionCards(state)).toBe(200);
  });
});
