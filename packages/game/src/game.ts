import type { Game, MoveFn } from 'boardgame.io';
import { ActivePlayers, INVALID_MOVE } from 'boardgame.io/core';
import {
  arrangeExpedition,
  attack,
  baselineConfig,
  buildStructure,
  buyDivineCoin,
  drawExpeditionCard,
  endActionPhase,
  guessProphecy,
  performRitual,
  playCurse,
  resolveForcedAttack,
  resolveDiscardChoice,
  setupGame,
  stopExpedition,
  type CurseTarget,
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
  /** Issued to the admin to start a match on the unpublished draft config. */
  draftToken?: string;
}

export interface ResolvedConfig {
  config: GameConfig;
  /** e.g. "v3" or "draft (based on v3)". */
  configVersion: string;
  build: string;
}

export interface PhoeniciansOptions {
  /** Looks up the config for a match. Runs on the server only. */
  resolveConfig?: (setupData: SetupData | undefined) => ResolvedConfig;
}

type Move = MoveFn<GameState>;
const serverOnly = (moves: Record<string, Move>) =>
  Object.fromEntries(Object.entries(moves).map(([name, move]) => [name, { move, client: false }]));

const toResult = (result: Result) => (result.ok ? undefined : INVALID_MOVE);
const rngFrom = (random: { Number: () => number }): Rng => ({ next: () => random.Number() });

/**
 * The boardgame.io wrapper. All rules live in the engine; this file only maps
 * moves to engine calls. Every player may send moves at any time and the engine
 * decides whether they are legal, which leaves room for out-of-turn curses.
 */
export function createPhoenicians(options: PhoeniciansOptions = {}): Game<GameState, Record<string, unknown>, SetupData> {
  const resolveConfig =
    options.resolveConfig ?? ((): ResolvedConfig => ({ config: baselineConfig, configVersion: 'baseline', build: 'dev' }));
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
      const resolved = resolveConfig(setupData);
      const G = setupGame(structuredClone(resolved.config), seats, setupData?.firstPlayer ?? '0', rngFrom(random));
      G.meta = { configVersion: resolved.configVersion, build: resolved.build };
      return G;
    },

    turn: { activePlayers: ActivePlayers.ALL },

    // Moves run on the server only (`client: false`): clients see a filtered view
    // without deck contents or other players' secrets, so they cannot predict results.
    moves: serverOnly({
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
      playCurse: ({ G, playerID, random }, cardId: string, target: CurseTarget) =>
        toResult(playCurse(G, playerID, cardId, target ?? {}, rngFrom(random))),
      arrangeExpedition: ({ G, playerID }, order: string[]) => toResult(arrangeExpedition(G, playerID, order)),
      forcedAttack: ({ G, playerID, random }, structureCardId: string) =>
        toResult(resolveForcedAttack(G, playerID, structureCardId, rngFrom(random))),
    }),

    endIf: ({ G }) => (G.winnerId ? { winner: G.winnerId } : undefined),

    playerView: ({ G, playerID }) => playerView(G, playerID),
  };
}

export const Phoenicians = createPhoenicians();
