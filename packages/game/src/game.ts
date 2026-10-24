import type { Game } from 'boardgame.io';
import { ActivePlayers, INVALID_MOVE } from 'boardgame.io/core';
import {
  attack,
  baselineConfig,
  buildStructure,
  buyDivineCoin,
  drawExpeditionCard,
  endActionPhase,
  guessProphecy,
  performRitual,
  resolveDiscardChoice,
  setupGame,
  stopExpedition,
  type GameConfig,
  type GameState,
  type ResourceMap,
  type Result,
  type Rng,
} from '@phoenicians/engine';
import { playerView } from './playerView';

/** Sent by the lobby when a match is created. */
export interface SetupData {
  /** Display names in seat order; index = boardgame.io playerID. */
  names: string[];
  /** playerID of the first player (the youngest). */
  firstPlayer: string;
  /** Config version id to play with; the server resolves it. */
  configVersion?: string;
}

export interface PhoeniciansOptions {
  /** Looks up the config for a match. Runs on the server only. */
  resolveConfig?: (setupData: SetupData | undefined) => GameConfig;
}

const toResult = (result: Result) => (result.ok ? undefined : INVALID_MOVE);
const rngFrom = (random: { Number: () => number }): Rng => ({ next: () => random.Number() });

/**
 * The boardgame.io wrapper. All rules live in the engine; this file only maps
 * moves to engine calls. Every player may send moves at any time and the engine
 * decides whether they are legal, which leaves room for out-of-turn curses.
 */
export function createPhoenicians(options: PhoeniciansOptions = {}): Game<GameState, Record<string, unknown>, SetupData> {
  const resolveConfig = options.resolveConfig ?? (() => baselineConfig);
  return {
    name: 'phoenicians',
    minPlayers: baselineConfig.players.min,
    maxPlayers: baselineConfig.players.max,

    validateSetupData(setupData, numPlayers) {
      if (!setupData) return undefined;
      if (setupData.names.length !== numPlayers) return 'names must match the player count';
      if (!setupData.names.some((_, i) => String(i) === setupData.firstPlayer)) return 'unknown first player';
      return undefined;
    },

    setup({ ctx, random }, setupData) {
      const names = setupData?.names ?? ctx.playOrder.map((id) => `Player ${Number(id) + 1}`);
      const seats = ctx.playOrder.map((id, i) => ({ id, name: names[i] ?? `Player ${i + 1}` }));
      const config = structuredClone(resolveConfig(setupData));
      return setupGame(config, seats, setupData?.firstPlayer ?? '0', rngFrom(random));
    },

    turn: { activePlayers: ActivePlayers.ALL },

    moves: {
      build: ({ G, playerID }, slot: number) => toResult(buildStructure(G, playerID, slot)),
      attack: ({ G, playerID, random }, targetId: string, structureCardId: string) =>
        toResult(attack(G, playerID, targetId, structureCardId, rngFrom(random))),
      ritual: ({ G, playerID, random }) => toResult(performRitual(G, playerID, rngFrom(random))),
      buyDivineCoin: ({ G, playerID }) => toResult(buyDivineCoin(G, playerID)),
      guessProphecy: ({ G, playerID, random }, targetId: string, prophecyId: string) =>
        toResult(guessProphecy(G, playerID, targetId, prophecyId, rngFrom(random))),
      endActions: ({ G, playerID }) => toResult(endActionPhase(G, playerID)),
      draw: ({ G, playerID, random }) => toResult(drawExpeditionCard(G, playerID, rngFrom(random))),
      stopExpedition: ({ G, playerID }) => toResult(stopExpedition(G, playerID)),
      chooseDiscard: ({ G, playerID }, selection: ResourceMap) => toResult(resolveDiscardChoice(G, playerID, selection)),
    },

    endIf: ({ G }) => (G.winnerId ? { winner: G.winnerId } : undefined),

    playerView: ({ G, playerID }) => playerView(G, playerID),
  };
}

export const Phoenicians = createPhoenicians();
