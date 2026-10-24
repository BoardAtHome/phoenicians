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
  /** Construction Ban: number of this player's upcoming turns without building. */
  constructionBans: number;
  /** True during a turn in which this player may not build. */
  constructionBanned: boolean;
  /** Revival: eliminated now, returns at the start of their next turn. */
  reviving: boolean;
}

/**
 * Something that happened and may still be answered with Curses. Entries resolve last-in, first-out,
 * each after its own reaction window closes.
 */
export type StackEntry = {
  id: number;
  playerId: string;
  canceled: boolean;
  /** Its reaction window has closed, so it resolves when it reaches the top. */
  windowDone: boolean;
} & (
  | { kind: 'attack'; targetId: string; structureCardId: string }
  | { kind: 'ritual'; interceptedBy: string | null }
  | { kind: 'calamity'; calamityId: string }
  | { kind: 'eliminate'; targetId: string; revived: boolean }
  | {
      kind: 'curse';
      curseId: string;
      target: CurseTargetInput;
      /** Players this Curse is played against; they may answer with Curse Negation. */
      affects: string[];
      /** For responses: the stack entry this Curse acts on. */
      entryId: number | null;
    }
  /** An action with nothing left to resolve, kept on the stack so others get a chance to respond. */
  | { kind: 'moment'; action: 'draw' | 'build' | 'buyDivineCoin' | 'guess' }
);

/** What a player supplies when playing a Curse. Which fields matter depends on the Curse. */
export interface CurseTargetInput {
  playerId?: string;
  /** Forced Conflict: the player whose structure gets attacked. */
  secondPlayerId?: string;
  resource?: Resource;
  /** Resource Exchange: what you give from inventory and what you take from the discard pile. */
  give?: Resource;
  take?: Resource;
  /** Military Sabotage: which of the target's structures to destroy. */
  structureCardIds?: string[];
}

/** A pause after an action in which other players may play Curses. Always about the top stack entry. */
export interface ReactionWindow {
  id: number;
  entryId: number;
  /** Players holding a Curse they could play now. */
  eligible: string[];
  passed: string[];
  /** Server time (ms) when the window may be closed. Null until the server stamps it. */
  deadline: number | null;
  /** Server time the deadline was last set, so clients can show the countdown without trusting their own clock. */
  updatedAt: number | null;
  /** A player choosing targets for a response; the countdown is paused meanwhile. */
  heldBy: string | null;
  /** Milliseconds left on the countdown while held. */
  remainingMs: number;
}

export interface Expedition {
  playerId: string;
  /** Forced Exploration: draws still required before a voluntary stop. */
  mustDraw: number;
  /** Cards drawn during this expedition, kept apart from inventory until it ends. */
  drawn: ResourceCard[];
  drawCount: number;
  lastDrawWasResource: boolean;
}

/** A choice the game is waiting on before it can continue. */
export type PendingChoice =
  /** The player picks `count` inventory cards to discard. */
  | {
      kind: 'discardInventory';
      playerId: string;
      count: number;
      source: { type: 'calamity'; calamityId: string } | { type: 'curse'; curseId: string };
    }
  /** Divine Foresight: the player reorders the top `count` Expedition cards. */
  | { kind: 'arrangeExpedition'; playerId: string; count: number }
  /** Forced Conflict: `playerId` must pick one of `targetId`'s structures to attack. */
  | { kind: 'forcedAttack'; playerId: string; targetId: string };

export type Phase = 'action' | 'expedition' | 'gameOver';

export interface GameEvent {
  turn: number;
  type: string;
  playerId?: string;
  data?: Record<string, unknown>;
}

export interface GameState {
  config: GameConfig;
  /** Which config version and app build the match runs on, for playtest records. */
  meta?: { configVersion: string; build: string };
  players: Player[];
  turn: {
    number: number;
    activePlayerId: string;
    phase: Phase;
    /** Extra Expedition: expeditions still owed to the active player after the current one. */
    extraExpeditions: number;
    /** Set during an out-of-turn Extra Expedition: whose turn comes next is counted from this player. */
    resumeAfter?: string;
  };
  /** Pending actions, top = last. */
  stack: StackEntry[];
  nextEntryId: number;
  window: ReactionWindow | null;
  nextWindowId: number;
  /** Players owed an out-of-turn Extra Expedition, run between turns. */
  extraExpeditionQueue: string[];
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
