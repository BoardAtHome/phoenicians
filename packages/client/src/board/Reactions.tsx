import { useEffect, useRef, useState } from 'react';
import { CURSE_TARGETS, canPlayInWindow, topEntry, type Player } from '@phoenicians/engine';
import type { PlayerViewState } from '@phoenicians/game';
import { describeEntry } from '../format';
import { CurseForm } from './Curses';

type Send = (move: string, ...args: unknown[]) => void;
type Moves = Record<string, ((...args: unknown[]) => void) | undefined>;

/** Seconds left on the window, counted on this device from when the server last set the deadline. */
function useCountdown(G: PlayerViewState): number {
  const window = G.window;
  const [now, setNow] = useState(Date.now());
  const endRef = useRef({ key: '', end: 0 });
  const key = window ? `${window.id}:${window.updatedAt}:${window.deadline}` : '';
  if (window && endRef.current.key !== key) {
    const duration = window.deadline !== null && window.updatedAt !== null ? window.deadline - window.updatedAt : G.config.reactions.windowSeconds * 1000;
    endRef.current = { key, end: Date.now() + duration };
  }
  useEffect(() => {
    if (!window) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [window?.id]);
  return Math.max(0, Math.ceil((endRef.current.end - now) / 1000));
}

/**
 * Shown while other players may respond to the last action. Players who can respond see their
 * usable Curses and a Pass button; everyone sees the countdown. When it runs out, any client
 * asks the server to close the window (the server checks its own clock).
 */
export function ReactionBar({ G, me, send, moves, busy }: { G: PlayerViewState; me: Player | undefined; send: Send; moves: Moves; busy: boolean }) {
  const window = G.window!;
  const entry = topEntry(G);
  const seconds = useCountdown(G);
  const [choosing, setChoosing] = useState<string | null>(null);

  // Ask the server to close the window once our countdown ends, retrying until it agrees.
  useEffect(() => {
    if (seconds > 0) return;
    moves.closeWindow?.(window.id);
    const retry = setInterval(() => moves.closeWindow?.(window.id), 1500);
    return () => clearInterval(retry);
  }, [seconds, window.id]);
  useEffect(() => setChoosing(null), [window.id]);

  const canRespond = !!me && window.eligible.includes(me.id) && !window.passed.includes(me.id);
  const usable = canRespond ? me!.curseHand.filter((c) => canPlayInWindow(G, me!.id, c.curseId)) : [];
  const card = usable.find((c) => c.id === choosing);
  const heldByOther = window.heldBy && window.heldBy !== me?.id;

  const play = (cardId: string, curseId: string) => {
    if ((CURSE_TARGETS[curseId] ?? []).length === 0) return send('playCurse', cardId, {});
    setChoosing(cardId);
    moves.holdWindow?.(window.id); // pause the countdown while choosing targets
  };
  const cancel = () => {
    setChoosing(null);
    if (window.heldBy === me?.id) send('releaseWindow', window.id);
  };

  return (
    <div className={`panel reaction ${canRespond ? 'mine' : ''}`}>
      <div className="row spread">
        <strong>{entry ? describeEntry(G, entry) : 'Waiting for reactions'}</strong>
        <span className="countdown" aria-live="polite">
          {window.heldBy ? (heldByOther ? 'Paused: a player is choosing a response' : 'Paused while you choose') : `${seconds}s`}
        </span>
      </div>
      {canRespond ? (
        <>
          <p className="small">You can respond with:</p>
          <div className="row wrap">
            {usable.map((c) => {
              const curse = G.config.curses.find((x) => x.id === c.curseId)!;
              return (
                <button key={c.id} className={choosing === c.id ? 'active' : ''} disabled={busy || (!!choosing && choosing !== c.id)} title={curse.text} onClick={() => play(c.id, c.curseId)}>
                  {curse.name}
                </button>
              );
            })}
            <button disabled={busy} onClick={() => send('pass', window.id)}>Pass</button>
          </div>
          {card && (
            <>
              <CurseForm key={card.id} G={G} me={me!} card={card} onPlay={(target) => { send('playCurse', card.id, target); setChoosing(null); }} />
              <button onClick={cancel}>Back</button>
            </>
          )}
        </>
      ) : (
        <p className="muted small">
          {window.passed.includes(me?.id ?? '') ? 'You passed. ' : ''}
          Waiting on {window.waitingCount} player{window.waitingCount === 1 ? '' : 's'} who may respond.
        </p>
      )}
    </div>
  );
}
