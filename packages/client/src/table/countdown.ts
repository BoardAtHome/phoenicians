import { useEffect, useRef, useState } from 'react';
import type { PlayerViewState } from '@phoenicians/game';

/** Seconds left on the window, counted on this device from when the server last set the deadline. */
export function useCountdown(G: PlayerViewState): number {
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
