import type { GameConfig, Resource } from './config/types';

export interface ResourceCard {
  id: string;
  type: 'resource';
  resource: Resource;
}

export interface CalamityCard {
  id: string;
  type: 'calamity';
  calamityId: string;
}

export type ExpeditionCard = ResourceCard | CalamityCard;

/** One physical copy of a building. Lives in the building deck, the shop, or a player's village. */
export interface StructureCard {
  id: string;
  structureId: string;
}

export interface CurseCard {
  id: string;
  curseId: string;
}

export type Inventory = Record<Resource, ResourceCard[]>;

export interface Player {
  id: string;
  name: string;
  eliminated: boolean;
  inventory: Inventory;
  structures: StructureCard[];
  curseHand: CurseCard[];
  prophecyId: string;
  divineCoins: number;
  /** Cumulative counters. They belong to the player and survive Prophecy replacement. */
  counters: { structuresDestroyed: number; ritualsPerformed: number };
}

export interface Expedition {
  playerId: string;
  /** Cards drawn during this expedition, kept apart from inventory until it ends. */
  drawn: ResourceCard[];
  drawCount: number;
  lastDrawWasResource: boolean;
}

/** A choice the game is waiting on before it can continue. */
export type PendingChoice = {
  kind: 'discardInventory';
  playerId: string;
  count: number;
  calamityId: string;
};

export type Phase = 'action' | 'expedition' | 'gameOver';

export interface GameEvent {
  turn: number;
  type: string;
  playerId?: string;
  data?: Record<string, unknown>;
}

export interface GameState {
  config: GameConfig;
  players: Player[];
  turn: { number: number; activePlayerId: string; phase: Phase };
  expeditionDeck: ExpeditionCard[];
  expeditionDiscard: ExpeditionCard[];
  expedition: Expedition | null;
  pendingChoice: PendingChoice | null;
  buildingDeck: StructureCard[];
  shop: (StructureCard | null)[];
  curseDeck: CurseCard[];
  curseDiscard: CurseCard[];
  /** Prophecy cards not dealt to anyone. Prophecy Disruption draws from here. */
  prophecyDeck: string[];
  /** Discarded and revealed Prophecies. Reshuffled into the deck if it runs out. */
  prophecyDiscard: string[];
  winnerId: string | null;
  log: GameEvent[];
}

export type Result = { ok: true } | { ok: false; error: string };
export const ok: Result = { ok: true };
export const fail = (error: string): Result => ({ ok: false, error });
