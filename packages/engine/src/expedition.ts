import { RESOURCES, type CalamityConfig, type ResourceMap } from './config/types';
import { addToInventory, inventorySize, takeFromInventory } from './inventory';
import { shuffle, type Rng } from './rng';
import type { ExpeditionCard, GameState, Player, Result } from './state';
import { fail, ok } from './state';
import { continueResolution, pushEntry } from './reactions';
import { checkActive, endTurn, getPlayer, log, newExpedition } from './turn';

function drawFromDeck(state: GameState, rng: Rng): ExpeditionCard | undefined {
  if (state.expeditionDeck.length === 0 && state.expeditionDiscard.length > 0) {
    state.expeditionDeck = shuffle(rng, state.expeditionDiscard);
    state.expeditionDiscard = [];
    log(state, 'expeditionDeckReshuffled');
  }
  return state.expeditionDeck.pop();
}

const noCardsLeft = (state: GameState) => state.expeditionDeck.length === 0 && state.expeditionDiscard.length === 0;

/** Moves surviving expedition cards into the explorer's inventory and ends the turn. */
export function finishExpedition(state: GameState, rng: Rng, reason: 'stopped' | 'calamity' | 'interrupted'): void {
  const expedition = state.expedition!;
  // Draws of this expedition can no longer be answered.
  for (const entry of state.stack) if (entry.kind === 'moment' && entry.action === 'draw') entry.canceled = true;
  const player = getPlayer(state, expedition.playerId)!;
  addToInventory(player.inventory, expedition.drawn);
  log(state, 'expeditionEnded', player.id, { kept: expedition.drawn.length, draws: expedition.drawCount, reason });
  state.expedition = null;
  if (state.turn.extraExpeditions > 0) {
    state.turn.extraExpeditions--;
    state.expedition = newExpedition(player.id);
    log(state, 'expeditionStarted', player.id, { extra: true });
    return;
  }
  endTurn(state, rng);
}

function discardAllInventory(state: GameState, player: Player): void {
  for (const r of RESOURCES) state.expeditionDiscard.push(...player.inventory[r].splice(0));
}

export function applyCalamity(state: GameState, player: Player, calamity: CalamityConfig, rng: Rng): void {
  const expedition = state.expedition!;
  const effect = calamity.effect;
  log(state, 'calamityApplied', player.id, { calamityId: calamity.id });

  switch (effect.kind) {
    case 'discardExpedition':
      state.expeditionDiscard.push(...expedition.drawn.splice(0));
      break;
    case 'discardInventoryResource':
      state.expeditionDiscard.push(...player.inventory[effect.resource].splice(0));
      break;
    case 'discardInventoryCount':
    case 'discardInventoryFraction': {
      const size = inventorySize(player.inventory);
      const count =
        effect.kind === 'discardInventoryCount'
          ? effect.count
          : (effect.rounding === 'up' ? Math.ceil : Math.floor)(size * effect.fraction);
      if (count >= size) {
        discardAllInventory(state, player);
      } else if (count > 0) {
        // The affected player picks which cards to discard.
        state.pendingChoice = {
          kind: 'discardInventory',
          playerId: player.id,
          count,
          source: { type: 'calamity', calamityId: calamity.id },
        };
        return;
      }
      break;
    }
  }
  finishExpedition(state, rng, 'calamity');
}

/** Draws one Expedition card for the explorer. */
export function drawExpeditionCard(state: GameState, playerId: string, rng: Rng): Result {
  const check = checkActive(state, playerId, 'expedition');
  if (!check.ok) return check;
  const expedition = state.expedition!;

  const card = drawFromDeck(state, rng);
  if (!card) return fail('The Expedition deck is empty');
  const drawIndex = expedition.drawCount++;
  if (expedition.mustDraw > 0) expedition.mustDraw--;

  if (card.type === 'resource') {
    expedition.drawn.push(card);
    expedition.lastDrawWasResource = true;
    log(state, 'expeditionDraw', playerId, { resource: card.resource, drawIndex });
    pushEntry(state, { kind: 'moment', playerId, action: 'draw' });
  } else {
    expedition.lastDrawWasResource = false;
    state.expeditionDiscard.push(card);
    if (drawIndex < state.config.expedition.ignoredCalamityDraws) {
      log(state, 'calamityIgnored', playerId, { calamityId: card.calamityId, drawIndex });
      pushEntry(state, { kind: 'moment', playerId, action: 'draw' });
    } else {
      // The Calamity strikes when it resolves, so Calamity Protection can still stop it.
      log(state, 'calamityDrawn', playerId, { calamityId: card.calamityId, drawIndex });
      pushEntry(state, { kind: 'calamity', playerId, calamityId: card.calamityId });
    }
  }
  continueResolution(state, rng);
  return ok;
}

/** Ends the expedition voluntarily, keeping everything drawn. */
export function stopExpedition(state: GameState, playerId: string, rng: Rng): Result {
  const check = checkActive(state, playerId, 'expedition');
  if (!check.ok) return check;
  const expedition = state.expedition!;
  if (!noCardsLeft(state)) {
    if (expedition.drawCount === 0) return fail('You must draw at least one card');
    if (!expedition.lastDrawWasResource) return fail('You can only stop right after drawing a resource');
    if (expedition.mustDraw > 0) return fail(`Forced Exploration: draw ${expedition.mustDraw} more before stopping`);
  }
  finishExpedition(state, rng, 'stopped');
  return ok;
}

/** The affected player picks which inventory cards a Calamity discards. */
export function resolveDiscardChoice(state: GameState, playerId: string, selection: ResourceMap, rng: Rng): Result {
  const pending = state.pendingChoice;
  if (!pending || pending.kind !== 'discardInventory') return fail('No discard is pending');
  if (pending.playerId !== playerId) return fail('This choice belongs to another player');
  const player = getPlayer(state, playerId)!;
  const total = RESOURCES.reduce((n, r) => n + selection[r], 0);
  if (total !== pending.count) return fail(`Choose exactly ${pending.count} cards`);
  for (const r of RESOURCES) {
    if (!Number.isInteger(selection[r]) || selection[r] < 0 || selection[r] > player.inventory[r].length) {
      return fail(`Invalid number of ${r}`);
    }
  }
  state.expeditionDiscard.push(...takeFromInventory(player.inventory, selection));
  log(state, 'discardChosen', playerId, { selection });
  state.pendingChoice = null;
  if (pending.source.type === 'calamity') finishExpedition(state, rng, 'calamity');
  continueResolution(state, rng);
  return ok;
}
