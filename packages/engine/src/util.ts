import type { GameState, Player } from './state';

export function getPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function log(state: GameState, type: string, playerId?: string, data?: Record<string, unknown>): void {
  state.log.push({ turn: state.turn.number, type, ...(playerId ? { playerId } : {}), ...(data ? { data } : {}) });
}

/** A playtest record that players only see once the game is over. */
export function logPrivate(state: GameState, type: string, playerId?: string, data?: Record<string, unknown>): void {
  log(state, type, playerId, data);
  state.log[state.log.length - 1]!.private = true;
}
