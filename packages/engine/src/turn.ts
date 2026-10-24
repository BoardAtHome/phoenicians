import { isProphecyMet } from './prophecy';
import type { GameState, Phase, Result } from './state';
import { fail, ok } from './state';
import { log } from './util';

export { getPlayer, log } from './util';

/** Checks that `playerId` is the active player, the game is in `phase`, and nothing is waiting on a choice. */
export function checkActive(state: GameState, playerId: string, phase: Phase): Result {
  if (state.turn.phase === 'gameOver') return fail('The game is over');
  if (state.turn.activePlayerId !== playerId) return fail('It is not your turn');
  if (state.turn.phase !== phase) return fail(`Not allowed during the ${state.turn.phase} phase`);
  if (state.pendingChoice) return fail('Waiting for a choice to be made');
  return ok;
}

/** Ends the action phase and starts the expedition. */
export function endActionPhase(state: GameState, playerId: string): Result {
  const check = checkActive(state, playerId, 'action');
  if (!check.ok) return check;
  state.turn.phase = 'expedition';
  state.expedition = { playerId, drawn: [], drawCount: 0, lastDrawWasResource: false };
  log(state, 'expeditionStarted', playerId);
  return ok;
}

/** Passes the turn to the next player still in the game. */
export function endTurn(state: GameState): void {
  const n = state.players.length;
  const current = state.players.findIndex((p) => p.id === state.turn.activePlayerId);
  state.players[current]!.constructionBanned = false;
  for (let step = 1; step <= n; step++) {
    const next = state.players[(current + step) % n]!;
    if (!next.eliminated) {
      state.turn = { number: state.turn.number + 1, activePlayerId: next.id, phase: 'action', extraExpeditions: 0 };
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
}

export function declareWinner(state: GameState, playerId: string, reason: 'prophecy' | 'lastPlayerStanding'): void {
  state.winnerId = playerId;
  state.turn.phase = 'gameOver';
  const player = state.players.find((p) => p.id === playerId)!;
  log(state, 'gameWon', playerId, { reason, prophecyId: player.prophecyId });
}
