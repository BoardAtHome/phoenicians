import type { GameState } from '@phoenicians/engine';

/** What a client is allowed to know. Deck contents are replaced by counts. */
export interface PlayerViewState extends GameState {
  counts: { expeditionDeck: number; buildingDeck: number; curseDeck: number; prophecyDeck: number };
}

export const HIDDEN = 'hidden';

/**
 * Hides everything that is secret from `playerID`: other players' curse hands
 * (only the count shows) and Prophecies (until revealed by elimination or victory),
 * plus the order of every deck. Inventories, structures and coins are public.
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
            curseHand: p.curseHand.map(() => ({ id: HIDDEN, curseId: HIDDEN })),
            prophecyId: p.eliminated || gameOver ? p.prophecyId : HIDDEN,
          },
    ),
    expeditionDeck: [],
    buildingDeck: [],
    curseDeck: [],
    prophecyDeck: [],
    prophecyDiscard: [],
    counts: {
      expeditionDeck: G.expeditionDeck.length,
      buildingDeck: G.buildingDeck.length,
      curseDeck: G.curseDeck.length,
      prophecyDeck: G.prophecyDeck.length,
    },
  };
}
