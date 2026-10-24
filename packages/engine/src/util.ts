import type { GameState, Player } from './state';

export function getPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function log(state: GameState, type: string, playerId?: string, data?: Record<string, unknown>): void {
  state.log.push({ turn: state.turn.number, type, ...(playerId ? { playerId } : {}), ...(data ? { data } : {}) });
}
