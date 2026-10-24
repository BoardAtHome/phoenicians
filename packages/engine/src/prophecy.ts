import type { ProphecyConfig } from './config/types';
import { shuffle, type Rng } from './rng';
import type { GameState, Player, Result } from './state';
import { fail, ok } from './state';
import { getPlayer, log } from './util';

export function getProphecy(state: GameState, prophecyId: string): ProphecyConfig {
  return state.config.prophecies.find((p) => p.id === prophecyId)!;
}

/** The player's current value for a Prophecy's metric. */
export function prophecyProgress(state: GameState, player: Player, prophecy: ProphecyConfig): number {
  const metric = prophecy.metric;
  switch (metric.kind) {
    case 'structuresDestroyed':
      return player.counters.structuresDestroyed;
    case 'ritualsPerformed':
      return player.counters.ritualsPerformed;
    case 'structuresOwned':
      if (!metric.category) return player.structures.length;
      return player.structures.filter(
        (s) => state.config.structures.find((c) => c.id === s.structureId)!.category === metric.category,
      ).length;
    case 'resourceHeld':
      return player.inventory[metric.resource].length;
  }
}

/**
 * Whether the player's Prophecy is satisfied right now. Cumulative counters never
 * decrease, so a cumulative Prophecy stays met once reached; conditional ones can be undone.
 */
export function isProphecyMet(state: GameState, player: Player): boolean {
  if (player.eliminated || !player.prophecyId) return false;
  const prophecy = getProphecy(state, player.prophecyId);
  return prophecyProgress(state, player, prophecy) >= prophecy.threshold;
}

/** Draws a Prophecy from the undealt pile, reshuffling discarded ones in if it is empty. */
export function drawProphecy(state: GameState, rng: Rng): string | undefined {
  if (state.prophecyDeck.length === 0 && state.prophecyDiscard.length > 0) {
    state.prophecyDeck = shuffle(rng, state.prophecyDiscard);
    state.prophecyDiscard = [];
  }
  return state.prophecyDeck.pop();
}

/**
 * Discards the player's Prophecy and gives them a random replacement (Prophecy Disruption).
 * Cumulative counters belong to the player, so progress carries over to the new Prophecy.
 */
export function replaceProphecy(state: GameState, playerId: string, rng: Rng): Result {
  const player = getPlayer(state, playerId);
  if (!player || player.eliminated) return fail('No such player in the game');
  const next = drawProphecy(state, rng);
  if (!next) return fail('No Prophecy cards are left to draw');
  state.prophecyDiscard.push(player.prophecyId);
  player.prophecyId = next;
  log(state, 'prophecyReplaced', playerId);
  return ok;
}
