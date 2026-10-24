/**
 * Game configuration. Every number in the game lives here so the admin can
 * tune it without a new build. Logic changes (new card effects, new rules)
 * need a new build and usually a new field here.
 */

export const RESOURCES = ['buildingMaterials', 'warriors', 'grain', 'purpleDye'] as const;
export type Resource = (typeof RESOURCES)[number];
export type ResourceMap = Record<Resource, number>;

export const STRUCTURE_CATEGORIES = ['civic', 'military', 'agricultural', 'commercial'] as const;
export type StructureCategory = (typeof STRUCTURE_CATEGORIES)[number];

/** How a Calamity behaves. Its numbers come from the config entry. */
export type CalamityEffect =
  /** Discard every card drawn so far in the current expedition. */
  | { kind: 'discardExpedition' }
  /** Affected player discards `count` inventory cards of their choice. */
  | { kind: 'discardInventoryCount'; count: number }
  /** Discard all inventory cards of one resource type. */
  | { kind: 'discardInventoryResource'; resource: Resource }
  /** Affected player discards a fraction of their inventory, of their choice. */
  | { kind: 'discardInventoryFraction'; fraction: number; rounding: 'up' | 'down' };

export interface CalamityConfig {
  id: string;
  name: string;
  copies: number;
  effect: CalamityEffect;
}

export interface StructureConfig {
  id: string;
  name: string;
  category: StructureCategory;
  cost: ResourceMap;
  copies: number;
}

export type ProphecyMetric =
  | { kind: 'structuresDestroyed' }
  | { kind: 'ritualsPerformed' }
  | { kind: 'structuresOwned'; category?: StructureCategory }
  | { kind: 'resourceHeld'; resource: Resource };

export interface ProphecyConfig {
  id: string;
  name: string;
  /** cumulative = counter that never decreases; conditional = checked against current holdings. */
  evaluation: 'cumulative' | 'conditional';
  metric: ProphecyMetric;
  threshold: number;
  copies: number;
}

export interface CurseConfig {
  id: string;
  name: string;
  /** Metadata only; no gameplay effect in the current version. */
  stars: 1 | 2 | 3;
  copies: number;
  text: string;
  /** Per-card numbers, e.g. Petty Theft's `steal: 2`. Keys are defined by the effect. */
  params: Record<string, number>;
}

export interface GameConfig {
  players: { min: number; max: number };
  setup: {
    startingResources: ResourceMap;
    startingCurses: number;
    /** null = no hand limit. */
    curseHandLimit: number | null;
    divineCoins: number;
  };
  expedition: {
    resourceCards: ResourceMap;
    calamities: CalamityConfig[];
    /** Number of opening draws on which a Calamity is ignored. Default 1 = first card only. */
    ignoredCalamityDraws: number;
  };
  shop: { slots: number };
  structures: StructureConfig[];
  costs: {
    attack: ResourceMap;
    ritual: ResourceMap;
    divineCoin: ResourceMap;
    /** Divine Coins spent per Prophecy guess. */
    guessProphecy: number;
  };
  prophecies: ProphecyConfig[];
  curses: CurseConfig[];
  reactions: {
    /** Seconds each reaction window stays open. */
    windowSeconds: number;
  };
}
