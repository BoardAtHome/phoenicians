import type { Game, MoveFn } from 'boardgame.io';
import { ActivePlayers, INVALID_MOVE } from 'boardgame.io/core';
import {
  arrangeExpedition,
  attack,
  baselineConfig,
  buildStructure,
  buyDivineCoin,
  closeWindow,
  drawExpeditionCard,
  endActionPhase,
  endMatch,
  guessProphecy,
  holdWindow,
  passWindow,
  performRitual,
  playCurse,
  releaseWindow,
  resolveForcedAttack,
  resolveDiscardChoice,
  setupGame,
  stampWindow,
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
/** Every move runs on the server, which also starts the countdown of any reaction window the move opened. */
const serverOnly = (moves: Record<string, Move>) =>
  Object.fromEntries(
    Object.entries(moves).map(([name, move]) => [
      name,
      {
        move: ((context, ...args) => {
          const before = context.G.log.length;
          const result = move(context, ...args);
          const now = Date.now();
          stampWindow(context.G, now);
          for (let i = before; i < context.G.log.length; i++) context.G.log[i]!.at ??= now;
          return result;
        }) as Move,
        client: false,
      },
    ]),
  );

/** `ctx.gameover` of a game ended without a winner: who ended it. */
export const gameoverOf = (G: GameState) => ({ endedBy: String(G.log.filter((e) => e.type === 'matchEnded').at(-1)?.data?.by ?? 'admin') });

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
      for (const e of G.log) e.at = Date.now();
      return G;
    },

    turn: { activePlayers: ActivePlayers.ALL },

    // Moves run on the server only (`client: false`): clients see a filtered view
    // without deck contents or other players' secrets, so they cannot predict results.
    moves: serverOnly({
      build: ({ G, playerID, random }, slot: number) => toResult(buildStructure(G, playerID, slot, rngFrom(random))),
      attack: ({ G, playerID, random }, targetId: string, structureCardId: string) =>
        toResult(attack(G, playerID, targetId, structureCardId, rngFrom(random))),
      ritual: ({ G, playerID, random }) => toResult(performRitual(G, playerID, rngFrom(random))),
      buyDivineCoin: ({ G, playerID, random }) => toResult(buyDivineCoin(G, playerID, rngFrom(random))),
      guessProphecy: ({ G, playerID, random }, targetId: string, prophecyId: string) =>
        toResult(guessProphecy(G, playerID, targetId, prophecyId, rngFrom(random))),
      endActions: ({ G, playerID }) => toResult(endActionPhase(G, playerID)),
      draw: ({ G, playerID, random }) => toResult(drawExpeditionCard(G, playerID, rngFrom(random))),
      stopExpedition: ({ G, playerID, random }) => toResult(stopExpedition(G, playerID, rngFrom(random))),
      chooseDiscard: ({ G, playerID, random }, selection: ResourceMap) =>
        toResult(resolveDiscardChoice(G, playerID, selection, rngFrom(random))),
      playCurse: ({ G, playerID, random }, cardId: string, target: CurseTarget) =>
        toResult(playCurse(G, playerID, cardId, target ?? {}, rngFrom(random))),
      arrangeExpedition: ({ G, playerID, random }, order: string[]) =>
        toResult(arrangeExpedition(G, playerID, order, rngFrom(random))),
      forcedAttack: ({ G, playerID, random }, structureCardId: string) =>
        toResult(resolveForcedAttack(G, playerID, structureCardId, rngFrom(random))),
      // Reaction windows. The server clock decides when a window may close.
      pass: ({ G, playerID, random }, windowId: number) => toResult(passWindow(G, playerID, windowId, rngFrom(random), Date.now())),
      holdWindow: ({ G, playerID }, windowId: number) => toResult(holdWindow(G, playerID, windowId, Date.now())),
      releaseWindow: ({ G, playerID }, windowId: number) => toResult(releaseWindow(G, playerID, windowId, Date.now())),
      closeWindow: ({ G, random }, windowId: number) => toResult(closeWindow(G, windowId, Date.now(), rngFrom(random))),
      // Any seated player can end the game for everyone, e.g. when the table stops playing.
      endGame: ({ G, playerID }) => toResult(endMatch(G, playerID)),
    }),

    endIf: ({ G }) => (G.winnerId ? { winner: G.winnerId } : G.turn.phase === 'gameOver' ? gameoverOf(G) : undefined),

    playerView: ({ G, playerID }) => playerView(G, playerID),
  };
}

export const Phoenicians = createPhoenicians();
