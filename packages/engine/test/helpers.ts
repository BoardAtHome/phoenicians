import { baselineConfig, createRng, setupGame, type ExpeditionCard, type GameState, type Player, type Resource } from '../src';

export const rng = () => createRng(42);

export function newGame(playerCount = 3, seed = 42): GameState {
  const seats = Array.from({ length: playerCount }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
  return setupGame(structuredClone(baselineConfig), seats, 'p0', createRng(seed));
}

let nextId = 0;
export const res = (resource: Resource): ExpeditionCard => ({ id: `t-${nextId++}`, type: 'resource', resource });
export const cal = (calamityId: string): ExpeditionCard => ({ id: `t-${nextId++}`, type: 'calamity', calamityId });

/** Puts cards on top of the Expedition deck so they are drawn in the order given. */
export function stackDeck(state: GameState, cards: ExpeditionCard[]): void {
  state.expeditionDeck.push(...[...cards].reverse());
}

export function give(player: Player, resource: Resource, count: number): void {
  for (let i = 0; i < count; i++) player.inventory[resource].push({ id: `t-${nextId++}`, type: 'resource', resource });
}

export const active = (state: GameState) => state.players.find((p) => p.id === state.turn.activePlayerId)!;

export function countAllExpeditionCards(state: GameState): number {
  let n = state.expeditionDeck.length + state.expeditionDiscard.length + (state.expedition?.drawn.length ?? 0);
  for (const p of state.players) n += Object.values(p.inventory).reduce((m, cards) => m + cards.length, 0);
  return n;
}
