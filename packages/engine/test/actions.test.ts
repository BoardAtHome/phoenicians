import { beforeEach, describe, expect, it } from 'vitest';
import {
  attack,
  buyDivineCoin,
  guessProphecy,
  inventorySize,
  performRitual,
  type GameState,
  type Player,
} from '../src';
import { active, give, grant, newGame, passTurn, rng } from './helpers';

let state: GameState;
let p0: Player;
let p1: Player;

beforeEach(() => {
  state = newGame();
  [p0, p1] = state.players as [Player, Player];
});

describe('attack', () => {
  beforeEach(() => grant(state, p1, 'farm'));

  it('spends 3 Warriors, destroys the structure, credits the attacker, and reshuffles it into the deck', () => {
    give(p0, 'warriors', 4);
    const target = p1.structures[0]!;
    const deckBefore = state.buildingDeck.length;
    expect(attack(state, 'p0', 'p1', target.id, rng()).ok).toBe(true);
    expect(p0.inventory.warriors).toHaveLength(1);
    expect(p1.structures).toHaveLength(0);
    expect(p0.counters.structuresDestroyed).toBe(1);
    expect(state.buildingDeck).toHaveLength(deckBefore + 1);
    expect(state.buildingDeck).toContainEqual(target);
  });

  it('refills an empty shop slot with the returned building', () => {
    state.buildingDeck = [];
    state.shop[3] = null;
    give(p0, 'warriors', 3);
    attack(state, 'p0', 'p1', p1.structures[0]!.id, rng());
    expect(state.shop[3]).toMatchObject({ structureId: 'farm' });
  });

  it('uses the configured cost', () => {
    state.config.costs.attack = { buildingMaterials: 1, warriors: 1, grain: 0, purpleDye: 0 };
    give(p0, 'warriors', 1);
    expect(attack(state, 'p0', 'p1', p1.structures[0]!.id, rng()).ok).toBe(false);
    give(p0, 'buildingMaterials', 1);
    expect(attack(state, 'p0', 'p1', p1.structures[0]!.id, rng()).ok).toBe(true);
  });

  it('refuses without enough Warriors, against yourself, or a missing structure', () => {
    give(p0, 'warriors', 2);
    expect(attack(state, 'p0', 'p1', p1.structures[0]!.id, rng()).ok).toBe(false);
    give(p0, 'warriors', 1);
    grant(state, p0, 'farm');
    expect(attack(state, 'p0', 'p0', p0.structures[0]!.id, rng()).ok).toBe(false);
    expect(attack(state, 'p0', 'p1', 'nope', rng()).ok).toBe(false);
    expect(p0.inventory.warriors).toHaveLength(3);
  });
});

describe('performRitual', () => {
  it('spends 4 Grain, draws a curse, and counts the ritual', () => {
    give(p0, 'grain', 4);
    expect(performRitual(state, 'p0', rng()).ok).toBe(true);
    expect(p0.curseHand).toHaveLength(4);
    expect(p0.counters.ritualsPerformed).toBe(1);
    expect(p0.inventory.grain).toHaveLength(0);
  });

  it('refuses without enough Grain or with a full hand', () => {
    give(p0, 'grain', 3);
    expect(performRitual(state, 'p0', rng()).ok).toBe(false);
    give(p0, 'grain', 1);
    state.config.setup.curseHandLimit = 3;
    expect(performRitual(state, 'p0', rng())).toEqual({ ok: false, error: 'Your curse hand is full' });
  });

  it('reshuffles the curse discard pile when the deck is empty', () => {
    state.curseDiscard = state.curseDeck.splice(0);
    give(p0, 'grain', 4);
    expect(performRitual(state, 'p0', rng()).ok).toBe(true);
    expect(state.curseDiscard).toHaveLength(0);
  });

  it('refuses when there are no curses anywhere, without taking Grain', () => {
    state.curseDeck = [];
    give(p0, 'grain', 4);
    expect(performRitual(state, 'p0', rng()).ok).toBe(false);
    expect(p0.inventory.grain).toHaveLength(4);
  });
});

describe('Divine Coins', () => {
  it('cost 5 Purple Dye each', () => {
    give(p0, 'purpleDye', 9);
    expect(buyDivineCoin(state, 'p0', rng()).ok).toBe(true);
    expect(buyDivineCoin(state, 'p0', rng()).ok).toBe(false);
    expect(p0.divineCoins).toBe(1);
    expect(p0.inventory.purpleDye).toHaveLength(4);
  });

  it('a wrong guess spends the coin and is logged publicly', () => {
    p0.divineCoins = 1;
    const wrong = state.config.prophecies.find((p) => p.id !== p1.prophecyId)!.id;
    expect(guessProphecy(state, 'p0', 'p1', wrong, rng()).ok).toBe(true);
    expect(p0.divineCoins).toBe(0);
    expect(p1.eliminated).toBe(false);
    expect(state.log.at(-1)).toMatchObject({ type: 'prophecyGuessed', data: { targetId: 'p1', prophecyId: wrong, correct: false } });
  });

  it('a correct guess eliminates the target and returns their cards', () => {
    p0.divineCoins = 1;
    grant(state, p1, 'palace');
    give(p1, 'grain', 3);
    const prophecy = p1.prophecyId;
    const discardBefore = state.expeditionDiscard.length;
    expect(guessProphecy(state, 'p0', 'p1', prophecy, rng()).ok).toBe(true);

    expect(p1.eliminated).toBe(true);
    expect(p1.structures).toHaveLength(0);
    expect(inventorySize(p1.inventory)).toBe(0);
    expect(p1.curseHand).toHaveLength(0);
    expect(state.expeditionDiscard).toHaveLength(discardBefore + 3);
    expect(state.curseDiscard).toHaveLength(3);
    expect(state.buildingDeck.some((s) => s.structureId === 'palace')).toBe(true);
    expect(state.prophecyDiscard).toContain(prophecy);

    passTurn(state);
    expect(active(state).id).toBe('p2'); // eliminated players are skipped
  });

  it('the last player standing wins', () => {
    p0.divineCoins = 2;
    guessProphecy(state, 'p0', 'p1', p1.prophecyId, rng());
    expect(state.winnerId).toBeNull();
    guessProphecy(state, 'p0', 'p2', state.players[2]!.prophecyId, rng());
    expect(state.winnerId).toBe('p0');
    expect(state.log.at(-1)).toMatchObject({ type: 'gameWon', data: { reason: 'lastPlayerStanding' } });
  });

  it('refuses without coins, against yourself, or an eliminated player', () => {
    expect(guessProphecy(state, 'p0', 'p1', p1.prophecyId, rng()).ok).toBe(false);
    p0.divineCoins = 3;
    expect(guessProphecy(state, 'p0', 'p0', p0.prophecyId, rng()).ok).toBe(false);
    guessProphecy(state, 'p0', 'p1', p1.prophecyId, rng());
    expect(guessProphecy(state, 'p0', 'p1', p1.prophecyId, rng()).ok).toBe(false);
    expect(p0.divineCoins).toBe(2);
  });
});
