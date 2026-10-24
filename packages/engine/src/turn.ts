import { drawProphecy, isProphecyMet } from './prophecy';
import type { Rng } from './rng';
import type { Expedition, GameState, Phase, Player, Result } from './state';
import { fail, ok } from './state';
import { getPlayer, log } from './util';

export { getPlayer, log } from './util';

/** Checks that `playerId` is the active player, the game is in `phase`, and nothing else is pending. */
export function checkActive(state: GameState, playerId: string, phase: Phase): Result {
  if (state.turn.phase === 'gameOver') return fail('The game is over');
  if (state.turn.activePlayerId !== playerId) return fail('It is not your turn');
  if (state.turn.phase !== phase) return fail(`Not allowed during the ${state.turn.phase} phase`);
  if (state.pendingChoice) return fail('Waiting for a choice to be made');
  if (state.window) return fail('Waiting for other players to react');
  if (state.stack.length > 0) return fail('Waiting for actions to resolve');
  return ok;
}

export const newExpedition = (playerId: string): Expedition => ({ playerId, mustDraw: 0, drawn: [], drawCount: 0, lastDrawWasResource: false });

/** Ends the action phase and starts the expedition. */
export function endActionPhase(state: GameState, playerId: string): Result {
  const check = checkActive(state, playerId, 'action');
  if (!check.ok) return check;
  state.turn.phase = 'expedition';
  state.expedition = newExpedition(playerId);
  log(state, 'expeditionStarted', playerId);
  return ok;
}

/** Revival: the player returns with a few Building Materials and a fresh Prophecy. */
function revive(state: GameState, player: Player, rng: Rng): void {
  const count = state.config.curses.find((c) => c.id === 'revival')?.params.buildingMaterials ?? 1;
  Object.assign(player, { eliminated: false, reviving: false, divineCoins: 0, constructionBans: 0, constructionBanned: false });
  for (let i = 0; i < count; i++) {
    const pile = [state.expeditionDiscard, state.expeditionDeck].find((p) => p.some((c) => c.type === 'resource' && c.resource === 'buildingMaterials'));
    if (!pile) break;
    const index = pile.findIndex((c) => c.type === 'resource' && c.resource === 'buildingMaterials');
    const [card] = pile.splice(index, 1);
    if (card?.type === 'resource') player.inventory.buildingMaterials.push(card);
  }
  player.prophecyId = drawProphecy(state, rng) ?? player.prophecyId;
  log(state, 'playerRevived', player.id);
}

/**
 * Passes the turn to the next player still in the game. Out-of-turn Extra Expeditions owed to
 * other players run first, then play continues after the player whose turn it was.
 */
export function endTurn(state: GameState, rng: Rng): void {
  const current = getPlayer(state, state.turn.activePlayerId)!;
  current.constructionBanned = false;

  while (state.extraExpeditionQueue.length > 0) {
    const explorer = getPlayer(state, state.extraExpeditionQueue.shift()!);
    if (!explorer || explorer.eliminated) continue;
    const resumeAfter = state.turn.resumeAfter ?? current.id;
    state.turn = { number: state.turn.number, activePlayerId: explorer.id, phase: 'expedition', extraExpeditions: 0, resumeAfter };
    state.expedition = newExpedition(explorer.id);
    log(state, 'expeditionStarted', explorer.id, { extra: true, outOfTurn: true });
    return;
  }

  const n = state.players.length;
  const from = state.players.findIndex((p) => p.id === (state.turn.resumeAfter ?? current.id));
  for (let step = 1; step <= n; step++) {
    const next = state.players[(from + step) % n]!;
    if (next.eliminated && !next.reviving) continue;
    state.turn = { number: state.turn.number + 1, activePlayerId: next.id, phase: 'action', extraExpeditions: 0 };
    if (next.reviving) revive(state, next, rng);
    log(state, 'turnStarted', next.id);
    if (next.constructionBans > 0) {
      next.constructionBans--;
      next.constructionBanned = true;
    }
    // Victory is checked automatically before the player can take any action.
    if (isProphecyMet(state, next)) declareWinner(state, next.id, 'prophecy');
    return;
  }
}

export function declareWinner(state: GameState, playerId: string, reason: 'prophecy' | 'lastPlayerStanding'): void {
  state.winnerId = playerId;
  state.turn.phase = 'gameOver';
  state.stack = [];
  state.window = null;
  const player = state.players.find((p) => p.id === playerId)!;
  log(state, 'gameWon', playerId, { reason, prophecyId: player.prophecyId });
}
