import { baselineConfig, createRng, drawExpeditionCard, endActionPhase, setupGame, stopExpedition, type ExpeditionCard, type GameState, type Player, type Resource } from '../src';

export const rng = () => createRng(42);

/** Reaction windows are off unless asked for, so older tests see actions resolve at once. */
export function newGame(playerCount = 3, seed = 42, { reactions = false } = {}): GameState {
  const seats = Array.from({ length: playerCount }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
  const config = structuredClone(baselineConfig);
  if (!reactions) config.reactions.windowSeconds = 0;
  return setupGame(config, seats, 'p0', createRng(seed));
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

/** Ends the active player's turn with a one-card expedition. */
export function passTurn(state: GameState): void {
  const id = state.turn.activePlayerId;
  endActionPhase(state, id);
  stackDeck(state, [res('grain')]);
  drawExpeditionCard(state, id, rng());
  stopExpedition(state, id, rng());
}

/** Gives a player a structure straight from the building deck, or a fresh copy if none is left. */
export function grant(state: GameState, player: Player, structureId: string): void {
  const index = state.buildingDeck.findIndex((s) => s.structureId === structureId);
  const card = index >= 0 ? state.buildingDeck.splice(index, 1)[0]! : { id: `t-${nextId++}`, structureId };
  player.structures.push(card);
}
