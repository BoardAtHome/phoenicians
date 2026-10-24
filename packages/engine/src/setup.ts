import { RESOURCES, type GameConfig } from './config/types';
import { validateConfig } from './config/validate';
import { addToInventory, emptyInventory } from './inventory';
import { shuffle, type Rng } from './rng';
import type { CurseCard, ExpeditionCard, GameState, Player, ResourceCard, StructureCard } from './state';

export interface Seat {
  id: string;
  name: string;
}

export class SetupError extends Error {}

/** Builds a fresh game. Throws SetupError if the config or seating is invalid. */
export function setupGame(config: GameConfig, seats: Seat[], firstPlayerId: string, rng: Rng): GameState {
  const errors = validateConfig(config);
  if (errors.length) throw new SetupError(`Invalid config:\n${errors.join('\n')}`);
  if (seats.length < config.players.min || seats.length > config.players.max) {
    throw new SetupError(`Need ${config.players.min}–${config.players.max} players, got ${seats.length}`);
  }
  if (new Set(seats.map((s) => s.id)).size !== seats.length) throw new SetupError('Player ids must be unique');
  if (!seats.some((s) => s.id === firstPlayerId)) throw new SetupError(`Unknown first player ${firstPlayerId}`);

  // Seat order starts with the first player; turns then go round in that order.
  const start = seats.findIndex((s) => s.id === firstPlayerId);
  const ordered = [...seats.slice(start), ...seats.slice(0, start)];

  const resourceCards: ResourceCard[] = [];
  for (const r of RESOURCES) {
    for (let i = 0; i < config.expedition.resourceCards[r]; i++) {
      resourceCards.push({ id: `res-${r}-${i}`, type: 'resource', resource: r });
    }
  }

  const players: Player[] = ordered.map((seat) => ({
    id: seat.id,
    name: seat.name,
    eliminated: false,
    inventory: emptyInventory(),
    structures: [],
    curseHand: [],
    prophecyId: '',
    divineCoins: config.setup.divineCoins,
    counters: { structuresDestroyed: 0, ritualsPerformed: 0 },
    constructionBans: 0,
    constructionBanned: false,
    reviving: false,
  }));

  // Starting resources come out of the expedition deck so the card total stays fixed.
  for (const player of players) {
    for (const r of RESOURCES) {
      for (let i = 0; i < config.setup.startingResources[r]; i++) {
        const index = resourceCards.findIndex((c) => c.resource === r);
        addToInventory(player.inventory, resourceCards.splice(index, 1));
      }
    }
  }

  const expeditionDeck: ExpeditionCard[] = [...resourceCards];
  for (const calamity of config.expedition.calamities) {
    for (let i = 0; i < calamity.copies; i++) {
      expeditionDeck.push({ id: `cal-${calamity.id}-${i}`, type: 'calamity', calamityId: calamity.id });
    }
  }
  shuffle(rng, expeditionDeck);

  const buildingDeck: StructureCard[] = [];
  for (const s of config.structures) {
    for (let i = 0; i < s.copies; i++) buildingDeck.push({ id: `str-${s.id}-${i}`, structureId: s.id });
  }
  shuffle(rng, buildingDeck);
  const shop = Array.from({ length: config.shop.slots }, () => buildingDeck.pop() ?? null);

  const curseDeck: CurseCard[] = [];
  for (const c of config.curses) {
    for (let i = 0; i < c.copies; i++) curseDeck.push({ id: `curse-${c.id}-${i}`, curseId: c.id });
  }
  shuffle(rng, curseDeck);

  const prophecyDeck: string[] = [];
  for (const p of config.prophecies) for (let i = 0; i < p.copies; i++) prophecyDeck.push(p.id);
  shuffle(rng, prophecyDeck);

  for (const player of players) {
    player.prophecyId = prophecyDeck.pop()!;
    player.curseHand.push(...curseDeck.splice(curseDeck.length - config.setup.startingCurses));
  }

  return {
    config,
    players,
    turn: { number: 1, activePlayerId: players[0]!.id, phase: 'action', extraExpeditions: 0 },
    expeditionDeck,
    expeditionDiscard: [],
    expedition: null,
    pendingChoice: null,
    stack: [],
    nextEntryId: 1,
    window: null,
    nextWindowId: 1,
    extraExpeditionQueue: [],
    buildingDeck,
    shop,
    curseDeck,
    curseDiscard: [],
    prophecyDeck,
    prophecyDiscard: [],
    winnerId: null,
    log: [{ turn: 1, type: 'gameStarted', data: { players: players.map((p) => p.id) } }],
  };
}
