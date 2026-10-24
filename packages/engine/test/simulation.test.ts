import { describe, expect, it } from 'vitest';
import {
  CURSE_TARGETS,
  RESOURCES,
  arrangeExpedition,
  attack,
  buildStructure,
  buyDivineCoin,
  canAfford,
  closeWindow,
  createRng,
  drawExpeditionCard,
  endActionPhase,
  eventsCsv,
  gameStats,
  foresightCards,
  passWindow,
  performRitual,
  playCurse,
  resolveDiscardChoice,
  resolveForcedAttack,
  sabotageCount,
  stampWindow,
  stopExpedition,
  type CurseTarget,
  type GameState,
  type Player,
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
function tryCurse(state: GameState, r: Rng, player: Player = active(state)): boolean {
  const card = pick(r, player.curseHand);
  if (!card) return false;
  if (!(card.curseId in CURSE_TARGETS)) return playCurse(state, player.id, card.id, {}, r).ok;
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
  return playCurse(state, player.id, card.id, target, r).ok;
}

/** Plays out open reaction windows and pending choices: players respond at random, pass, or let the timer run out. */
function settle(state: GameState, r: Rng) {
  for (let guard = 0; state.window || state.pendingChoice; guard++) {
    expect(guard).toBeLessThan(500);
    if (state.pendingChoice) {
      resolvePending(state, r);
      continue;
    }
    const window = state.window!;
    const waiting = window.eligible.filter((id) => !window.passed.includes(id));
    const responderId = pick(r, waiting);
    const responder = state.players.find((p) => p.id === responderId)!;
    const roll = r.next();
    if (roll < 0.5 && tryCurse(state, r, responder)) continue;
    if (roll < 0.8) expect(passWindow(state, responder.id, window.id, r).ok).toBe(true);
    else {
      stampWindow(state, 0);
      expect(closeWindow(state, window.id, 1e9, r).ok).toBe(true);
    }
  }
}

/** Plays many random turns and checks that no card is ever lost or duplicated. */
describe('random play', () => {
  it.each([
    [3, false],
    [5, false],
    [6, false],
    [3, true],
    [5, true],
    [6, true],
  ])('keeps every card accounted for over 300 turns with %i players (reactions: %s)', (playerCount, reactions) => {
    const state = newGame(playerCount, playerCount, { reactions });
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
      if (state.turn.phase === 'action') {
        performRitual(state, player.id, r);
        settle(state, r);
        buyDivineCoin(state, player.id, r);
        settle(state, r);
        for (let i = 0; i < 2 && !state.winnerId; i++) {
          tryCurse(state, r);
          settle(state, r);
        }
        const victim = state.players.find((p) => p.id !== player.id && !p.eliminated && p.structures.length > 0);
        if (victim && r.next() < 0.5) attack(state, player.id, victim.id, victim.structures[0]!.id, r);
        settle(state, r);
        for (let slot = 0; slot < state.shop.length; slot++) {
          const card = state.shop[slot];
          const cost = card && state.config.structures.find((s) => s.id === card.structureId)!.cost;
          if (cost && canAfford(player.inventory, cost)) buildStructure(state, player.id, slot, r);
          settle(state, r);
        }
        checkInvariants();
        if (state.winnerId) break;
        expect(endActionPhase(state, player.id).ok).toBe(true);
      }

      // Also covers Extra Expeditions; an out-of-turn one hands over to its explorer.
      const turn = state.turn.number;
      while (state.turn.phase === 'expedition' && state.turn.activePlayerId === player.id && state.turn.number === turn) {
        const expedition = state.expedition!;
        if (expedition.lastDrawWasResource && expedition.mustDraw === 0 && r.next() < 0.3) {
          expect(stopExpedition(state, player.id, r).ok).toBe(true);
        } else expect(drawExpeditionCard(state, player.id, r).ok).toBe(true);
        settle(state, r);
        checkInvariants();
      }
    }
    // The run should exercise Curses, not just skip them.
    expect(state.log.filter((e) => e.type === 'cursePlayed').length).toBeGreaterThan(5);
    const stats = gameStats(state);
    expect(stats.expeditions.count).toBe(state.log.filter((e) => e.type === 'expeditionEnded').length);
    expect(stats.prophecies.length).toBeGreaterThanOrEqual(playerCount);
    expect(eventsCsv(state).split('\n').length).toBeGreaterThan(state.log.length);
    if (reactions) expect(state.log.filter((e) => e.type === 'cursePlayed' && e.data?.answering).length).toBeGreaterThan(0);
    if (process.env.SIM_STATS) {
      const counts: Record<string, number> = {};
      for (const e of state.log) counts[e.type] = (counts[e.type] ?? 0) + 1;
      console.log(playerCount, reactions, state.turn.number, state.winnerId, counts);
    }
  });
});
