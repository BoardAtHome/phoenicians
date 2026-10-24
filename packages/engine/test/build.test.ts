import { beforeEach, describe, expect, it } from 'vitest';
import { buildStructure, endActionPhase, inventoryCounts, type GameState, type Player } from '../src';
import { give, newGame } from './helpers';

let state: GameState;
let p0: Player;

beforeEach(() => {
  state = newGame();
  p0 = state.players[0]!;
  // Put a known building in slot 0: Barracks costs 7 BM + 2 Warriors.
  state.shop[0] = { id: 'test-barracks', structureId: 'barracks' };
});

describe('buildStructure', () => {
  it('pays the cost, takes the building, and refills the slot', () => {
    give(p0, 'buildingMaterials', 8);
    give(p0, 'warriors', 2);
    const nextInDeck = state.buildingDeck.at(-1);
    const discardBefore = state.expeditionDiscard.length;

    expect(buildStructure(state, 'p0', 0)).toEqual({ ok: true });
    expect(p0.structures).toEqual([{ id: 'test-barracks', structureId: 'barracks' }]);
    expect(inventoryCounts(p0.inventory)).toEqual({ buildingMaterials: 1, warriors: 0, grain: 0, purpleDye: 0 });
    expect(state.expeditionDiscard.length).toBe(discardBefore + 9);
    expect(state.shop[0]).toEqual(nextInDeck);
    expect(state.buildingDeck).toHaveLength(17);
  });

  it('allows several builds in one turn while affordable', () => {
    give(p0, 'buildingMaterials', 30);
    give(p0, 'warriors', 10);
    state.shop[1] = { id: 'test-tower', structureId: 'archer-tower' };
    expect(buildStructure(state, 'p0', 0).ok).toBe(true);
    expect(buildStructure(state, 'p0', 1).ok).toBe(true);
    expect(p0.structures).toHaveLength(2);
  });

  it('refuses when the player cannot afford it', () => {
    give(p0, 'buildingMaterials', 7);
    give(p0, 'warriors', 1);
    expect(buildStructure(state, 'p0', 0)).toEqual({ ok: false, error: 'You cannot afford Barracks' });
    expect(inventoryCounts(p0.inventory).buildingMaterials).toBe(7);
  });

  it('refuses an empty slot', () => {
    state.shop[2] = null;
    expect(buildStructure(state, 'p0', 2).ok).toBe(false);
    expect(buildStructure(state, 'p0', 99).ok).toBe(false);
  });

  it('refuses out of turn or during the expedition', () => {
    give(state.players[1]!, 'buildingMaterials', 20);
    give(state.players[1]!, 'warriors', 5);
    expect(buildStructure(state, 'p1', 0).ok).toBe(false);
    give(p0, 'buildingMaterials', 20);
    give(p0, 'warriors', 5);
    endActionPhase(state, 'p0');
    expect(buildStructure(state, 'p0', 0).ok).toBe(false);
  });

  it('leaves the slot empty when the building deck is exhausted', () => {
    state.buildingDeck = [];
    give(p0, 'buildingMaterials', 7);
    give(p0, 'warriors', 2);
    buildStructure(state, 'p0', 0);
    expect(state.shop[0]).toBeNull();
  });
});
