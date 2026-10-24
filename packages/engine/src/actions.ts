import { RESOURCES } from './config/types';
import { canAfford, takeFromInventory } from './inventory';
import { getProphecy } from './prophecy';
import { shuffle, type Rng } from './rng';
import type { GameState, Player, Result } from './state';
import { fail, ok } from './state';
import { checkActive, declareWinner } from './turn';
import { getPlayer, log } from './util';

/** Fills empty shop slots from the building deck, e.g. after a destroyed building returns. */
export function refillShop(state: GameState): void {
  for (let i = 0; i < state.shop.length; i++) {
    if (!state.shop[i]) state.shop[i] = state.buildingDeck.pop() ?? null;
  }
}

/**
 * Removes a structure from its owner, returns it to the building deck and shuffles.
 * `creditedTo` gets a point toward The Conqueror.
 */
export function destroyStructure(state: GameState, ownerId: string, structureCardId: string, creditedTo: string | null, rng: Rng): Result {
  const owner = getPlayer(state, ownerId);
  const index = owner?.structures.findIndex((s) => s.id === structureCardId) ?? -1;
  if (!owner || index < 0) return fail('That structure does not exist');
  const [card] = owner.structures.splice(index, 1);
  state.buildingDeck.push(card!);
  shuffle(rng, state.buildingDeck);
  refillShop(state);
  if (creditedTo) getPlayer(state, creditedTo)!.counters.structuresDestroyed++;
  log(state, 'structureDestroyed', ownerId, { structureId: card!.structureId, creditedTo });
  return ok;
}

/** Spends Warriors to destroy any opponent's structure. */
export function attack(state: GameState, attackerId: string, targetId: string, structureCardId: string, rng: Rng): Result {
  const check = checkActive(state, attackerId, 'action');
  if (!check.ok) return check;
  if (attackerId === targetId) return fail('You cannot attack your own structures');
  const attacker = getPlayer(state, attackerId)!;
  const target = getPlayer(state, targetId);
  if (!target || target.eliminated) return fail('That player is not in the game');
  if (!target.structures.some((s) => s.id === structureCardId)) return fail('That structure does not exist');
  if (!canAfford(attacker.inventory, state.config.costs.attack)) return fail('Not enough resources to attack');

  state.expeditionDiscard.push(...takeFromInventory(attacker.inventory, state.config.costs.attack));
  log(state, 'attacked', attackerId, { targetId, structureCardId });
  return destroyStructure(state, targetId, structureCardId, attackerId, rng);
}

/** Spends Grain to draw a Curse. Counts toward The High Priest. */
export function performRitual(state: GameState, playerId: string, rng: Rng): Result {
  const check = checkActive(state, playerId, 'action');
  if (!check.ok) return check;
  const player = getPlayer(state, playerId)!;
  const limit = state.config.setup.curseHandLimit;
  if (limit !== null && player.curseHand.length >= limit) return fail('Your curse hand is full');
  if (!canAfford(player.inventory, state.config.costs.ritual)) return fail('Not enough resources for a ritual');
  if (state.curseDeck.length === 0 && state.curseDiscard.length === 0) return fail('No curses are left to draw');

  state.expeditionDiscard.push(...takeFromInventory(player.inventory, state.config.costs.ritual));
  if (state.curseDeck.length === 0) {
    state.curseDeck = shuffle(rng, state.curseDiscard);
    state.curseDiscard = [];
    log(state, 'curseDeckReshuffled');
  }
  player.curseHand.push(state.curseDeck.pop()!);
  player.counters.ritualsPerformed++;
  log(state, 'ritualPerformed', playerId);
  return ok;
}

/** Exchanges resources (Purple Dye by default) for a Divine Coin. */
export function buyDivineCoin(state: GameState, playerId: string): Result {
  const check = checkActive(state, playerId, 'action');
  if (!check.ok) return check;
  const player = getPlayer(state, playerId)!;
  if (!canAfford(player.inventory, state.config.costs.divineCoin)) return fail('Not enough resources for a Divine Coin');
  state.expeditionDiscard.push(...takeFromInventory(player.inventory, state.config.costs.divineCoin));
  player.divineCoins++;
  log(state, 'divineCoinBought', playerId);
  return ok;
}

/** Removes a player from the game. Their cards return to the shared piles. */
export function eliminatePlayer(state: GameState, playerId: string, rng: Rng): void {
  const player = getPlayer(state, playerId)!;
  player.eliminated = true;
  state.buildingDeck.push(...player.structures.splice(0));
  shuffle(rng, state.buildingDeck);
  refillShop(state);
  for (const r of RESOURCES) state.expeditionDiscard.push(...player.inventory[r].splice(0));
  state.curseDiscard.push(...player.curseHand.splice(0));
  state.prophecyDiscard.push(player.prophecyId);
  log(state, 'playerEliminated', playerId, { prophecyId: player.prophecyId });

  const remaining = state.players.filter((p) => !p.eliminated);
  if (remaining.length === 1) declareWinner(state, remaining[0]!.id, 'lastPlayerStanding');
}

/** Spends Divine Coins to guess another player's Prophecy. A correct guess eliminates them. Guesses are public. */
export function guessProphecy(state: GameState, guesserId: string, targetId: string, prophecyId: string, rng: Rng): Result {
  const check = checkActive(state, guesserId, 'action');
  if (!check.ok) return check;
  if (guesserId === targetId) return fail('You cannot guess your own Prophecy');
  const guesser: Player = getPlayer(state, guesserId)!;
  const target = getPlayer(state, targetId);
  if (!target || target.eliminated) return fail('That player is not in the game');
  if (!state.config.prophecies.some((p) => p.id === prophecyId)) return fail('Unknown Prophecy');
  const cost = state.config.costs.guessProphecy;
  if (guesser.divineCoins < cost) return fail('Not enough Divine Coins');

  guesser.divineCoins -= cost;
  const correct = target.prophecyId === prophecyId;
  log(state, 'prophecyGuessed', guesserId, { targetId, prophecyId, correct, name: getProphecy(state, prophecyId).name });
  if (correct) eliminatePlayer(state, targetId, rng);
  return ok;
}
