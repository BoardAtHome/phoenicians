import { beforeEach, describe, expect, it } from 'vitest';
import {
  drawExpeditionCard,
  endActionPhase,
  inventoryCounts,
  inventorySize,
  resolveDiscardChoice,
  stopExpedition,
  type GameState,
  type Player,
} from '../src';
import { active, cal, give, newGame, res, rng, stackDeck } from './helpers';

let state: GameState;
let p0: Player;
const r = rng();
const draw = () => drawExpeditionCard(state, 'p0', r);
const sel = (buildingMaterials = 0, warriors = 0, grain = 0, purpleDye = 0) => ({ buildingMaterials, warriors, grain, purpleDye });

beforeEach(() => {
  state = newGame();
  p0 = state.players[0]!;
  endActionPhase(state, 'p0');
});

describe('expedition basics', () => {
  it('requires at least one draw before stopping', () => {
    expect(stopExpedition(state, 'p0', rng())).toEqual({ ok: false, error: 'You must draw at least one card' });
  });

  it('keeps drawn cards apart from inventory until the expedition ends', () => {
    stackDeck(state, [res('grain'), res('warriors')]);
    draw();
    draw();
    expect(state.expedition!.drawn).toHaveLength(2);
    expect(inventorySize(p0.inventory)).toBe(0);
    expect(stopExpedition(state, 'p0', rng()).ok).toBe(true);
    expect(inventoryCounts(p0.inventory)).toEqual(sel(0, 1, 1, 0));
  });

  it('ends the turn when the expedition stops, so new cards cannot be spent this turn', () => {
    stackDeck(state, [res('grain')]);
    draw();
    stopExpedition(state, 'p0', rng());
    expect(state.turn).toMatchObject({ activePlayerId: 'p1', phase: 'action', number: 2 });
    expect(state.expedition).toBeNull();
  });

  it('rejects draws from other players or outside the expedition phase', () => {
    expect(drawExpeditionCard(state, 'p1', r).ok).toBe(false);
    stackDeck(state, [res('grain')]);
    draw();
    stopExpedition(state, 'p0', rng());
    expect(draw().ok).toBe(false);
  });

  it('reshuffles the discard pile when the deck runs out', () => {
    state.expeditionDiscard = state.expeditionDeck.filter((c) => c.type === 'resource');
    state.expeditionDeck = [];
    expect(draw().ok).toBe(true);
    expect(state.expeditionDeck.length).toBe(169);
    expect(state.log.some((e) => e.type === 'expeditionDeckReshuffled')).toBe(true);
  });

  it('lets the explorer stop when no cards are left anywhere', () => {
    state.expeditionDeck = [];
    state.expeditionDiscard = [];
    expect(draw().ok).toBe(false);
    expect(stopExpedition(state, 'p0', rng()).ok).toBe(true);
  });
});

describe('first-card Calamity', () => {
  it('is ignored, discarded, and the expedition continues', () => {
    give(p0, 'grain', 4);
    stackDeck(state, [cal('discard-grain'), res('warriors')]);
    draw();
    expect(p0.inventory.grain).toHaveLength(4);
    expect(state.turn.phase).toBe('expedition');
    expect(state.expeditionDiscard.at(-1)).toMatchObject({ type: 'calamity' });
    expect(state.log.at(-1)!.type).toBe('calamityIgnored');
  });

  it('cannot be followed by a voluntary stop', () => {
    stackDeck(state, [cal('discard-half')]);
    draw();
    expect(stopExpedition(state, 'p0', rng()).ok).toBe(false);
  });

  it('respects the configured number of ignored draws', () => {
    state.config.expedition.ignoredCalamityDraws = 0;
    give(p0, 'grain', 4);
    stackDeck(state, [cal('discard-grain')]);
    draw();
    expect(p0.inventory.grain).toHaveLength(0);
  });

  it('only protects the first card', () => {
    give(p0, 'grain', 4);
    stackDeck(state, [cal('discard-grain'), cal('discard-grain')]);
    draw();
    draw();
    expect(p0.inventory.grain).toHaveLength(0);
    expect(state.turn.activePlayerId).toBe('p1');
  });
});

describe('later Calamities', () => {
  const afterOneResource = (calamityId: string) => {
    stackDeck(state, [res('purpleDye'), cal(calamityId)]);
    draw();
    draw();
  };

  it('discard entire current expedition: loses drawn cards, keeps inventory', () => {
    give(p0, 'grain', 3);
    afterOneResource('discard-expedition');
    expect(inventoryCounts(p0.inventory)).toEqual(sel(0, 0, 3, 0));
    expect(state.turn.activePlayerId).toBe('p1');
  });

  it.each([
    ['discard-purple-dye', 'purpleDye'],
    ['discard-warriors', 'warriors'],
    ['discard-building-materials', 'buildingMaterials'],
    ['discard-grain', 'grain'],
  ] as const)('%s: removes that resource from existing inventory only', (id, resource) => {
    give(p0, 'buildingMaterials', 2);
    give(p0, 'warriors', 2);
    give(p0, 'grain', 2);
    give(p0, 'purpleDye', 2);
    afterOneResource(id);
    const counts = inventoryCounts(p0.inventory);
    expect(counts[resource]).toBe(resource === 'purpleDye' ? 1 : 0); // the drawn Purple Dye survives
    expect(inventorySize(p0.inventory)).toBe(7);
    expect(state.turn.activePlayerId).toBe('p1');
  });

  it.each([
    ['discard-5', 5],
    ['discard-4', 4],
  ] as const)('%s: the player chooses %i cards, then expedition cards are kept', (id, count) => {
    give(p0, 'buildingMaterials', 4);
    give(p0, 'grain', 4);
    afterOneResource(id);
    expect(state.pendingChoice).toMatchObject({ kind: 'discardInventory', playerId: 'p0', count });
    expect(state.turn.activePlayerId).toBe('p0');

    expect(resolveDiscardChoice(state, 'p0', sel(0, 0, 0, count), rng()).ok).toBe(false); // drawn Purple Dye isn't in inventory yet
    expect(resolveDiscardChoice(state, 'p0', sel(2, 0, count - 2, 0), rng()).ok).toBe(true);
    expect(inventoryCounts(p0.inventory)).toEqual(sel(2, 0, 6 - count, 1));
    expect(state.pendingChoice).toBeNull();
    expect(state.turn.activePlayerId).toBe('p1');
  });

  it('discard N with N or fewer cards discards everything without asking', () => {
    give(p0, 'grain', 3);
    afterOneResource('discard-5');
    expect(state.pendingChoice).toBeNull();
    expect(inventoryCounts(p0.inventory)).toEqual(sel(0, 0, 0, 1));
  });

  it('discard half rounds up and lets the player choose', () => {
    give(p0, 'warriors', 5);
    afterOneResource('discard-half');
    expect(state.pendingChoice).toMatchObject({ count: 3 });
    resolveDiscardChoice(state, 'p0', sel(0, 3, 0, 0), rng());
    expect(inventoryCounts(p0.inventory)).toEqual(sel(0, 2, 0, 1));
  });

  it('discard half of one card discards it without asking', () => {
    give(p0, 'warriors', 1);
    afterOneResource('discard-half');
    expect(state.pendingChoice).toBeNull();
    expect(inventoryCounts(p0.inventory)).toEqual(sel(0, 0, 0, 1));
  });

  it('inventory Calamities on an empty inventory do nothing but end the turn', () => {
    afterOneResource('discard-half');
    expect(inventoryCounts(p0.inventory)).toEqual(sel(0, 0, 0, 1));
    expect(state.turn.activePlayerId).toBe('p1');
  });

  it('blocks other actions while a discard choice is pending', () => {
    give(p0, 'grain', 8);
    afterOneResource('discard-4');
    expect(draw().ok).toBe(false);
    expect(stopExpedition(state, 'p0', rng()).ok).toBe(false);
    expect(resolveDiscardChoice(state, 'p1', sel(0, 0, 4, 0), rng()).ok).toBe(false);
    expect(resolveDiscardChoice(state, 'p0', sel(0, 0, 3, 0), rng()).ok).toBe(false);
  });
});

describe('turn order', () => {
  it('skips eliminated players', () => {
    state.players[1]!.eliminated = true;
    stackDeck(state, [res('grain')]);
    draw();
    stopExpedition(state, 'p0', rng());
    expect(active(state).id).toBe('p2');
  });
});
