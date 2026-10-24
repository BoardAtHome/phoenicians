import { canAfford, takeFromInventory } from './inventory';
import type { GameState, Result } from './state';
import { fail, ok } from './state';
import { checkActive, getPlayer, log } from './turn';

/** Buys the building in a shop slot, then refills the slot from the building deck. */
export function buildStructure(state: GameState, playerId: string, slot: number): Result {
  const check = checkActive(state, playerId, 'action');
  if (!check.ok) return check;
  if (getPlayer(state, playerId)!.constructionBanned) return fail('A Construction Ban stops you building this turn');
  const card = state.shop[slot];
  if (!card) return fail('That shop slot is empty');
  const structure = state.config.structures.find((s) => s.id === card.structureId)!;
  const player = getPlayer(state, playerId)!;
  if (!canAfford(player.inventory, structure.cost)) return fail(`You cannot afford ${structure.name}`);

  state.expeditionDiscard.push(...takeFromInventory(player.inventory, structure.cost));
  player.structures.push(card);
  state.shop[slot] = state.buildingDeck.pop() ?? null;
  log(state, 'structureBuilt', playerId, { structureId: structure.id, slot });
  return ok;
}
