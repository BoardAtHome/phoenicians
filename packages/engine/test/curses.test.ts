import { beforeEach, describe, expect, it } from 'vitest';
import {
  arrangeExpedition,
  buildStructure,
  drawExpeditionCard,
  endActionPhase,
  foresightCards,
  inventoryCounts,
  inventorySize,
  passWindow,
  playCurse,
  resolveDiscardChoice,
  resolveForcedAttack,
  stopExpedition,
  type CurseTarget,
  type GameState,
  type Player,
} from '../src';
import { give, grant, newGame, passTurn, res, rng, stackDeck } from './helpers';

let state: GameState;
let p0: Player;
let p1: Player;
let p2: Player;
const r = rng();

/** Puts a specific Curse into p0's hand and plays it. */
function cast(curseId: string, target: CurseTarget = {}, playerId = 'p0') {
  const player = state.players.find((p) => p.id === playerId)!;
  const card = { id: `test-${curseId}-${player.curseHand.length}`, curseId };
  player.curseHand.push(card);
  return playCurse(state, playerId, card.id, target, r);
}

beforeEach(() => {
  state = newGame();
  [p0, p1, p2] = state.players as [Player, Player, Player];
});

describe('playing Curses', () => {
  it('moves the card to the discard pile and logs it publicly', () => {
    const before = p0.curseHand.length;
    expect(cast('market-manipulation').ok).toBe(true);
    expect(p0.curseHand).toHaveLength(before);
    expect(state.curseDiscard.at(-1)!.curseId).toBe('market-manipulation');
    expect(state.log.at(-1)).toMatchObject({ type: 'cursePlayed', playerId: 'p0', data: { curseId: 'market-manipulation' } });
  });

  it('outside a reaction window, is only allowed on your own turn', () => {
    give(p1, 'grain', 1);
    expect(cast('mass-theft', {}, 'p1').ok).toBe(false);
    endActionPhase(state, 'p0');
    expect(cast('mass-theft').ok).toBe(true);
  });

  it('refuses reactive Curses and cards not in hand', () => {
    expect(cast('attack-negation').ok).toBe(false);
    expect(playCurse(state, 'p0', 'nope', {}, r).ok).toBe(false);
  });

  it('leaves the card in hand when the play is invalid', () => {
    const before = p0.curseHand.length;
    expect(cast('petty-theft', { playerId: 'p0' }).ok).toBe(false); // must be an opponent
    expect(p0.curseHand).toHaveLength(before + 1);
  });
});

describe('Curse effects', () => {
  it('Resource Exchange swaps one inventory card for one from the discard pile', () => {
    give(p0, 'grain', 1);
    state.expeditionDiscard.push(res('purpleDye'));
    expect(cast('resource-exchange', { give: 'grain', take: 'purpleDye' }).ok).toBe(true);
    expect(inventoryCounts(p0.inventory)).toMatchObject({ grain: 0, purpleDye: 1 });
    expect(state.expeditionDiscard.at(-1)).toMatchObject({ resource: 'grain' });
  });

  it('Resource Exchange cannot be played with nothing to take or give', () => {
    give(p0, 'grain', 1);
    expect(cast('resource-exchange', { give: 'grain', take: 'warriors' }).ok).toBe(false);
    state.expeditionDiscard.push(res('warriors'));
    expect(cast('resource-exchange', { give: 'purpleDye', take: 'warriors' }).ok).toBe(false);
  });

  it('Petty Theft steals 2 random resources, or as many as there are', () => {
    give(p1, 'warriors', 3);
    cast('petty-theft', { playerId: 'p1' });
    expect(inventorySize(p0.inventory)).toBe(2);
    expect(inventorySize(p1.inventory)).toBe(1);
    cast('petty-theft', { playerId: 'p1' });
    expect(inventorySize(p0.inventory)).toBe(3);
  });

  it('Mass Theft steals 1 from every opponent', () => {
    give(p1, 'grain', 2);
    give(p2, 'warriors', 2);
    cast('mass-theft');
    expect(inventoryCounts(p0.inventory)).toMatchObject({ grain: 1, warriors: 1 });
    expect(state.log.at(-1)).toMatchObject({ type: 'resourcesStolen', playerId: 'p0', data: { curseId: 'mass-theft', from: { p1: 1, p2: 1 } } });
  });

  it('Mass Theft skips opponents with nothing and logs only who lost a card', () => {
    give(p2, 'grain', 1);
    expect(cast('mass-theft').ok).toBe(true);
    expect(inventorySize(p0.inventory)).toBe(1);
    expect(state.log.at(-1)).toMatchObject({ type: 'resourcesStolen', data: { from: { p2: 1 } } });
  });

  it('Theft Curses cannot be played when there is nothing to steal, so the card is kept', () => {
    // Bug report: Mass Theft was used up but gave nothing, since nobody held resources yet.
    const hand = p0.curseHand.length;
    expect(cast('mass-theft').ok).toBe(false);
    expect(cast('petty-theft', { playerId: 'p1' }).ok).toBe(false);
    expect(p0.curseHand).toHaveLength(hand + 2);
    expect(state.curseDiscard).toHaveLength(0);
  });

  it('a Theft Curse whose victims empty their inventory before it resolves has no effect', () => {
    state = newGame(3, 42, { reactions: true });
    [p0, p1, p2] = state.players as [Player, Player, Player];
    give(p1, 'grain', 1);
    p1.curseHand.push({ id: 'p1-mt', curseId: 'mass-theft' });
    expect(cast('mass-theft').ok).toBe(true);
    expect(state.window).not.toBeNull();
    p1.inventory.grain.splice(0); // e.g. spent by a response
    for (const id of state.window!.eligible) passWindow(state, id, state.window!.id, r);
    expect(state.log.at(-1)).toMatchObject({ type: 'curseFizzled', data: { curseId: 'mass-theft' } });
  });

  it('Divine Foresight shows the top 3 cards to the player and lets them reorder', () => {
    stackDeck(state, [res('grain'), res('warriors'), res('purpleDye')]);
    cast('divine-foresight');
    const seen = foresightCards(state);
    expect(seen.map((c) => (c.type === 'resource' ? c.resource : ''))).toEqual(['grain', 'warriors', 'purpleDye']);
    expect(arrangeExpedition(state, 'p1', [], rng()).ok).toBe(false);
    expect(arrangeExpedition(state, 'p0', [seen[0]!.id], rng()).ok).toBe(false);
    expect(arrangeExpedition(state, 'p0', [seen[2]!.id, seen[0]!.id, seen[1]!.id], rng()).ok).toBe(true);
    endActionPhase(state, 'p0');
    drawExpeditionCard(state, 'p0', r);
    expect(state.expedition!.drawn[0]!.resource).toBe('purpleDye');
  });

  it('Extra Expedition starts another expedition after the first ends', () => {
    cast('extra-expedition');
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain'), res('warriors')]);
    drawExpeditionCard(state, 'p0', r);
    stopExpedition(state, 'p0', rng());
    expect(state.turn.activePlayerId).toBe('p0');
    expect(state.expedition).toMatchObject({ playerId: 'p0', drawCount: 0 });
    drawExpeditionCard(state, 'p0', r);
    stopExpedition(state, 'p0', rng());
    expect(state.turn.activePlayerId).toBe('p1');
    expect(inventoryCounts(p0.inventory)).toMatchObject({ grain: 1, warriors: 1 });
  });

  it('Construction Ban stops the target building during their next turn only', () => {
    cast('construction-ban', { playerId: 'p1' });
    passTurn(state);
    give(p1, 'buildingMaterials', 30);
    give(p1, 'warriors', 5);
    state.shop[0] = { id: 'x', structureId: 'archer-tower' };
    expect(buildStructure(state, 'p1', 0, rng())).toEqual({ ok: false, error: 'A Construction Ban stops you building this turn' });
    passTurn(state);
    passTurn(state);
    passTurn(state);
    state.shop[0] = { id: 'y', structureId: 'archer-tower' };
    expect(buildStructure(state, 'p1', 0, rng()).ok).toBe(true);
  });

  it('Market Manipulation replaces the whole shop', () => {
    const before = state.shop.map((c) => c!.id);
    cast('market-manipulation');
    expect(state.shop.every(Boolean)).toBe(true);
    expect(state.buildingDeck.length + state.shop.length).toBe(24);
    expect(state.shop.map((c) => c!.id)).not.toEqual(before);
  });

  it('Forced Conflict makes Player A attack a structure of Player B, credited to A', () => {
    give(p1, 'warriors', 3);
    grant(state, p2, 'farm');
    cast('forced-conflict', { playerId: 'p1', secondPlayerId: 'p2' });
    expect(state.pendingChoice).toEqual({ kind: 'forcedAttack', playerId: 'p1', targetId: 'p2' });
    expect(resolveForcedAttack(state, 'p0', p2.structures[0]!.id, r).ok).toBe(false);
    expect(resolveForcedAttack(state, 'p1', p2.structures[0]!.id, r).ok).toBe(true);
    expect(p2.structures).toHaveLength(0);
    expect(p1.inventory.warriors).toHaveLength(0);
    expect(p1.counters.structuresDestroyed).toBe(1);
  });

  it('Forced Conflict does nothing without enough Warriors or a target', () => {
    give(p1, 'warriors', 2);
    grant(state, p2, 'farm');
    expect(cast('forced-conflict', { playerId: 'p1', secondPlayerId: 'p2' }).ok).toBe(true);
    expect(state.pendingChoice).toBeNull();
    expect(cast('forced-conflict', { playerId: 'p1', secondPlayerId: 'p1' }).ok).toBe(false);
  });

  it('Resource Purge discards all of one resource', () => {
    give(p1, 'grain', 4);
    give(p1, 'warriors', 1);
    cast('resource-purge', { playerId: 'p1', resource: 'grain' });
    expect(inventoryCounts(p1.inventory)).toMatchObject({ grain: 0, warriors: 1 });
  });

  it('Military Sabotage destroys one structure per 3 Warriors the target holds, credited to the caster', () => {
    give(p1, 'warriors', 7);
    grant(state, p1, 'farm');
    grant(state, p1, 'barracks');
    grant(state, p1, 'palace');
    const ids = p1.structures.map((s) => s.id);
    expect(cast('military-sabotage', { playerId: 'p1', structureCardIds: [ids[0]!] }).ok).toBe(false);
    expect(cast('military-sabotage', { playerId: 'p1', structureCardIds: [ids[0]!, ids[2]!] }).ok).toBe(true);
    expect(p1.structures.map((s) => s.id)).toEqual([ids[1]]);
    expect(p1.inventory.warriors).toHaveLength(7);
    expect(p0.counters.structuresDestroyed).toBe(2);
  });

  it('Structural Burden makes the target choose one card per structure', () => {
    grant(state, p1, 'farm');
    grant(state, p1, 'barracks');
    give(p1, 'grain', 5);
    cast('structural-burden', { playerId: 'p1' });
    expect(state.pendingChoice).toMatchObject({ kind: 'discardInventory', playerId: 'p1', count: 2 });
    const sel = { buildingMaterials: 0, warriors: 0, grain: 2, purpleDye: 0 };
    expect(resolveDiscardChoice(state, 'p1', sel, rng()).ok).toBe(true);
    expect(p1.inventory.grain).toHaveLength(3);
    expect(state.turn).toMatchObject({ activePlayerId: 'p0', phase: 'action' }); // the caster's turn carries on
  });

  it('Prophecy Disruption gives the target a new random Prophecy', () => {
    const old = p1.prophecyId;
    cast('prophecy-disruption', { playerId: 'p1' });
    expect(p1.prophecyId).not.toBe(old);
    expect(state.prophecyDiscard).toContain(old);
  });

  it('uses configured per-card numbers', () => {
    state.config.curses.find((c) => c.id === 'petty-theft')!.params.steal = 4;
    give(p1, 'grain', 5);
    cast('petty-theft', { playerId: 'p1' });
    expect(inventorySize(p0.inventory)).toBe(4);
  });
});
