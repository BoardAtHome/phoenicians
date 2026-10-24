import { describe, expect, it } from 'vitest';
import {
  RESOURCES,
  buildStructure,
  canAfford,
  createRng,
  drawExpeditionCard,
  endActionPhase,
  resolveDiscardChoice,
  stopExpedition,
} from '../src';
import { active, countAllExpeditionCards, newGame } from './helpers';

/** Plays many random turns and checks invariants after every step. */
describe('random play', () => {
  it.each([3, 5, 7])('keeps every card accounted for over 300 turns with %i players', (playerCount) => {
    const state = newGame(playerCount, playerCount);
    const r = createRng(playerCount * 100);
    const totalStructures = state.config.structures.reduce((n, s) => n + s.copies, 0);

    while (state.turn.number < 300) {
      const player = active(state);
      for (let slot = 0; slot < state.shop.length; slot++) {
        const card = state.shop[slot];
        const cost = card && state.config.structures.find((s) => s.id === card.structureId)!.cost;
        if (cost && canAfford(player.inventory, cost)) buildStructure(state, player.id, slot);
      }
      expect(endActionPhase(state, player.id).ok).toBe(true);

      while (state.turn.activePlayerId === player.id) {
        if (state.pendingChoice) {
          const selection = { buildingMaterials: 0, warriors: 0, grain: 0, purpleDye: 0 };
          let left = state.pendingChoice.count;
          for (const res of RESOURCES) {
            const take = Math.min(left, player.inventory[res].length);
            selection[res] = take;
            left -= take;
          }
          expect(resolveDiscardChoice(state, player.id, selection).ok).toBe(true);
        } else if (state.expedition!.lastDrawWasResource && r.next() < 0.3) {
          expect(stopExpedition(state, player.id).ok).toBe(true);
        } else {
          expect(drawExpeditionCard(state, player.id, r).ok).toBe(true);
        }
        expect(countAllExpeditionCards(state)).toBe(200);
      }

      const structures =
        state.buildingDeck.length +
        state.shop.filter(Boolean).length +
        state.players.reduce((n, p) => n + p.structures.length, 0);
      expect(structures).toBe(totalStructures);
    }
  });
});
