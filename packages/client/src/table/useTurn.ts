import { useEffect, useRef, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { Player } from '@phoenicians/engine';
import type { PlayerViewState } from '@phoenicians/game';

export type Send = (move: string, ...args: unknown[]) => void;

// Seat colors, by seat order, so every player sees the same color for the same person.
const SEAT_COLORS = ['#3b6ea8', '#2f7a4b', '#c0662a', '#1f8a8a', '#b5487a', '#8a6a2f'];
export const seatColor = (G: PlayerViewState, id: string) => SEAT_COLORS[G.players.findIndex((p) => p.id === id) % SEAT_COLORS.length]!;

/** How long a move may go unanswered before the game reconnects to catch up. */
export const STALE_AFTER_MS = 6000;

/** What the current player may do right now, plus a `send` that allows one move in flight at a time. */
export function useTurn({ G, moves, playerID, onStale }: Pick<BoardProps<PlayerViewState>, 'G' | 'moves' | 'playerID'> & { onStale?: () => void }) {
  // The server rejects a move sent before the previous one's result arrives,
  // so buttons stay disabled until the new state comes back.
  const [busy, setBusy] = useState(false);
  const busyTimer = useRef<ReturnType<typeof setTimeout>>();
  // The server answers every move it reads, even one it refuses. Silence means this device lost its
  // connection or fell behind the server (which ignores moves sent from an outdated state).
  const staleTimer = useRef<ReturnType<typeof setTimeout>>();
  const stopStaleTimer = () => {
    clearTimeout(staleTimer.current);
    staleTimer.current = undefined;
  };
  useEffect(() => {
    setBusy(false);
    clearTimeout(busyTimer.current);
    stopStaleTimer();
  }, [G]);
  useEffect(() => stopStaleTimer, []);
  const send: Send = (name, ...args) => {
    if (busy) return;
    setBusy(true);
    busyTimer.current = setTimeout(() => setBusy(false), 3000);
    // Counted from the first unanswered move, so pressing again does not push it back.
    staleTimer.current ??= setTimeout(() => {
      staleTimer.current = undefined;
      onStale?.();
    }, STALE_AFTER_MS);
    moves[name]!(...args);
  };

  const me: Player | undefined = G.players.find((p) => p.id === playerID);
  const active = G.players.find((p) => p.id === G.turn.activePlayerId)!;
  const myTurn = !!me && active.id === me.id && G.turn.phase !== 'gameOver';
  // Nothing waiting on reactions or on another player's choice.
  const settled = !G.window && G.stack.length === 0 && !G.pendingChoice;
  const canAct = myTurn && G.turn.phase === 'action' && settled && !busy;
  const exploring = myTurn && G.turn.phase === 'expedition' && settled && !busy;
  const noCardsLeft = G.counts.expeditionDeck === 0 && G.expeditionDiscard.length === 0;
  const canStop =
    exploring && !!G.expedition && ((G.expedition.drawCount > 0 && G.expedition.lastDrawWasResource && G.expedition.mustDraw === 0) || noCardsLeft);
  const winner = G.winnerId ? G.players.find((p) => p.id === G.winnerId) : undefined;

  return { send, busy, me, active, myTurn, settled, canAct, exploring, canStop, noCardsLeft, winner };
}

export type Turn = ReturnType<typeof useTurn>;

/**
 * Rivals in turn order after you, placed around the table as if you sat at the bottom:
 * the next player on your left, then across the top, then on your right.
 */
export function seating(G: PlayerViewState, myId: string | undefined) {
  const start = Math.max(0, G.players.findIndex((p) => p.id === myId));
  const rivals = [...G.players.slice(start + 1), ...G.players.slice(0, start)].filter((p) => p.id !== myId);
  if (rivals.length <= 2) return { left: [], top: rivals, right: [] };
  return { left: rivals.slice(0, 1), top: rivals.slice(1, -1), right: rivals.slice(-1) };
}

/** Index of the last item matching `test`, or -1 (Array.prototype.findLastIndex needs newer browsers). */
export function lastIndex<T>(items: readonly T[], test: (item: T) => unknown): number {
  for (let i = items.length - 1; i >= 0; i--) if (test(items[i]!)) return i;
  return -1;
}
