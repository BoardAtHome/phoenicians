import { describe, expect, it } from 'vitest';
import {
  CURSE_TARGETS,
  RESOURCES,
  arrangeExpedition,
  attack,
  buildStructure,
  buyDivineCoin,
  canAfford,
  createRng,
  drawExpeditionCard,
  endActionPhase,
  foresightCards,
  performRitual,
  playCurse,
  resolveDiscardChoice,
  resolveForcedAttack,
  sabotageCount,
  stopExpedition,
  type CurseTarget,
  type GameState,
  type Rng,
} from '../src';
import { active, countAllExpeditionCards, newGame } from './helpers';

const pick = <T,>(rng: Rng, items: T[]): T | undefined => items[Math.floor(rng.next() * items.length)];

/** Answers whatever choice the game is waiting on. */
function resolvePending(state: GameState, r: Rng) {
  const pending = state.pendingChoice!;
  const player = state.players.find((p) => p.id === pending.playerId)!;
  switch (pending.kind) {
    case 'discardInventory': {
      const selection = { buildingMaterials: 0, warriors: 0, grain: 0, purpleDye: 0 };
      let left = pending.count;
      for (const res of RESOURCES) {
        const take = Math.min(left, player.inventory[res].length);
        selection[res] = take;
        left -= take;
      }
      expect(resolveDiscardChoice(state, player.id, selection, r).ok).toBe(true);
      break;
    }
    case 'arrangeExpedition':
      expect(arrangeExpedition(state, player.id, foresightCards(state).map((c) => c.id).reverse(), r).ok).toBe(true);
      break;
    case 'forcedAttack': {
      const victim = state.players.find((p) => p.id === pending.targetId)!;
      expect(resolveForcedAttack(state, player.id, victim.structures[0]!.id, r).ok).toBe(true);
      break;
    }
  }
}

/** Tries to play a random Curse from hand with plausible random targets. */
function tryCurse(state: GameState, r: Rng) {
  const player = active(state);
  const card = pick(r, player.curseHand);
  if (!card || !(card.curseId in CURSE_TARGETS)) return;
  const others = state.players.filter((p) => !p.eliminated && p.id !== player.id);
  const anyone = state.players.filter((p) => !p.eliminated);
  const target: CurseTarget = {
    playerId: pick(r, CURSE_TARGETS[card.curseId]!.includes('opponent') ? others : anyone)?.id,
    resource: pick(r, [...RESOURCES]),
    give: pick(r, [...RESOURCES]),
    take: pick(r, [...RESOURCES]),
  };
  target.secondPlayerId = pick(r, anyone.filter((p) => p.id !== target.playerId))?.id;
  const victim = state.players.find((p) => p.id === target.playerId);
  if (victim) target.structureCardIds = victim.structures.slice(0, sabotageCount(state, victim)).map((s) => s.id);
  playCurse(state, player.id, card.id, target, r);
}

/** Plays many random turns and checks that no card is ever lost or duplicated. */
describe('random play', () => {
  it.each([3, 5, 7])('keeps every card accounted for over 300 turns with %i players', (playerCount) => {
    const state = newGame(playerCount, playerCount);
    const r = createRng(playerCount * 100);
    const totalStructures = state.config.structures.reduce((n, s) => n + s.copies, 0);
    const totalCurses = state.config.curses.reduce((n, c) => n + c.copies, 0);

    const checkInvariants = () => {
      expect(countAllExpeditionCards(state)).toBe(200);
      const structures =
        state.buildingDeck.length + state.shop.filter(Boolean).length + state.players.reduce((n, p) => n + p.structures.length, 0);
      expect(structures).toBe(totalStructures);
      const curses = state.curseDeck.length + state.curseDiscard.length + state.players.reduce((n, p) => n + p.curseHand.length, 0);
      expect(curses).toBe(totalCurses);
      const prophecies = state.prophecyDeck.length + state.prophecyDiscard.length + state.players.filter((p) => !p.eliminated).length;
      expect(prophecies).toBe(8);
    };

    while (state.turn.number < 300 && !state.winnerId) {
      const player = active(state);
      performRitual(state, player.id, r);
      buyDivineCoin(state, player.id, r);
      for (let i = 0; i < 2 && !state.winnerId; i++) {
        tryCurse(state, r);
        while (state.pendingChoice) resolvePending(state, r);
      }
      const victim = state.players.find((p) => p.id !== player.id && !p.eliminated && p.structures.length > 0);
      if (victim && r.next() < 0.5) attack(state, player.id, victim.id, victim.structures[0]!.id, r);
      for (let slot = 0; slot < state.shop.length; slot++) {
        const card = state.shop[slot];
        const cost = card && state.config.structures.find((s) => s.id === card.structureId)!.cost;
        if (cost && canAfford(player.inventory, cost)) buildStructure(state, player.id, slot, r);
      }
      checkInvariants();
      if (state.winnerId) break;
      expect(endActionPhase(state, player.id).ok).toBe(true);

      while (state.turn.activePlayerId === player.id) {
        if (state.pendingChoice) resolvePending(state, r);
        else if (state.expedition!.lastDrawWasResource && r.next() < 0.3) expect(stopExpedition(state, player.id, r).ok).toBe(true);
        else expect(drawExpeditionCard(state, player.id, r).ok).toBe(true);
        checkInvariants();
      }
    }
    // The run should exercise Curses, not just skip them.
    expect(state.log.filter((e) => e.type === 'cursePlayed').length).toBeGreaterThan(5);
  });
});
