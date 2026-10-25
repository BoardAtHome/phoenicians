import { foresightCards, type ExpeditionCard, type GameState, type ReactionWindow } from '@phoenicians/engine';

/** What a client is allowed to know. Deck contents are replaced by counts. */
/** Who may respond is hidden, since it hints at what others hold: each player only learns about themselves. */
export interface WindowView extends ReactionWindow {
  /** Players still deciding. */
  waitingCount: number;
}

export interface PlayerViewState extends Omit<GameState, 'window'> {
  window: WindowView | null;
  counts: { expeditionDeck: number; buildingDeck: number; curseDeck: number; prophecyDeck: number };
  /** Divine Foresight: the top Expedition cards, top first, shown only to the player arranging them. */
  foresight: ExpeditionCard[];
}

export const HIDDEN = 'hidden';

/**
 * Hides everything that is secret from `playerID`: other players' curse hands
 * (only the count shows), Prophecies (until revealed by elimination or victory),
 * auto "Not now" settings, and the order of every deck. Inventories, structures and coins are public.
 */
export function playerView(G: GameState, playerID: string | null | undefined): PlayerViewState {
  const gameOver = G.turn.phase === 'gameOver';
  return {
    ...G,
    players: G.players.map((p) =>
      p.id === playerID
        ? p
        : {
            ...p,
            autoPass: undefined,
            curseHand: p.curseHand.map(() => ({ id: HIDDEN, curseId: HIDDEN })),
            prophecyId: p.eliminated || gameOver ? p.prophecyId : HIDDEN,
          },
    ),
    window: G.window && {
      ...G.window,
      eligible: G.window.eligible.filter((id) => id === playerID),
      passed: G.window.passed.filter((id) => id === playerID),
      waitingCount: G.window.eligible.filter((id) => !G.window!.passed.includes(id)).length,
    },
    log: gameOver ? G.log : G.log.filter((e) => !e.private),
    expeditionDeck: [],
    buildingDeck: [],
    curseDeck: [],
    prophecyDeck: [],
    prophecyDiscard: [],
    foresight: G.pendingChoice?.kind === 'arrangeExpedition' && G.pendingChoice.playerId === playerID ? foresightCards(G) : [],
    counts: {
      expeditionDeck: G.expeditionDeck.length,
      buildingDeck: G.buildingDeck.length,
      curseDeck: G.curseDeck.length,
      prophecyDeck: G.prophecyDeck.length,
    },
  };
}
