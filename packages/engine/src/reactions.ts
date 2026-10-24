import { destroyStructure, eliminatePlayer } from './actions';
import { REACTIVE_CURSES, prepareCurse } from './curses';
import { applyCalamity } from './expedition';
import { shuffle, type Rng } from './rng';
import type { GameState, Result, StackEntry } from './state';
import { fail, ok } from './state';
import { getPlayer, log } from './util';

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type NewEntry = DistributiveOmit<StackEntry, 'id' | 'canceled' | 'windowDone'>;

/** Puts an action on the stack. Call `continueResolution` afterwards. */
export function pushEntry(state: GameState, entry: NewEntry): StackEntry {
  const full = { ...entry, id: state.nextEntryId++, canceled: false, windowDone: false } as StackEntry;
  state.stack.push(full);
  return full;
}

export const topEntry = (state: GameState): StackEntry | undefined => state.stack[state.stack.length - 1];

/** Whether a Curse may answer this stack entry. Curses without a trigger may be played in any window. */
export function canRespondWith(state: GameState, playerId: string, curseId: string, entry: StackEntry): boolean {
  if (entry.kind === 'eliminate') return curseId === 'revival' && entry.targetId === playerId;
  if (!REACTIVE_CURSES.has(curseId)) return true;
  const exploring = entry.kind === 'moment' && entry.action === 'draw' && entry.playerId !== playerId && state.expedition?.playerId === entry.playerId;
  switch (curseId) {
    case 'attack-negation':
      return entry.kind === 'attack' && entry.playerId !== playerId;
    case 'curse-negation':
      return entry.kind === 'curse' && entry.affects.includes(playerId);
    case 'divine-interception':
      return entry.kind === 'ritual' && entry.playerId !== playerId && !entry.interceptedBy;
    case 'calamity-protection':
      return entry.kind === 'calamity' && entry.playerId === playerId;
    case 'expedition-interruption':
    case 'forced-exploration':
      return exploring;
    case 'expedition-theft':
      return exploring && state.expedition!.drawn.length > 0;
    default:
      return false;
  }
}

/** Whether `playerId` may play this Curse in the open reaction window. */
export function canPlayInWindow(state: GameState, playerId: string, curseId: string): boolean {
  const window = state.window;
  const entry = topEntry(state);
  if (!window || !entry || entry.id !== window.entryId) return false;
  if (!window.eligible.includes(playerId) || window.passed.includes(playerId)) return false;
  return canRespondWith(state, playerId, curseId, entry);
}

/** Opens a reaction window on the top entry. Returns false if nobody holds a Curse they could play. */
function openWindow(state: GameState, entry: StackEntry): boolean {
  if (!(state.config.reactions.windowSeconds > 0)) return false;
  const candidates = state.players.filter((p) => {
    if (p.eliminated) return false;
    if (entry.kind === 'eliminate') return p.id === entry.targetId;
    // The explorer may answer their own Calamity (Calamity Protection).
    return entry.kind === 'calamity' || p.id !== entry.playerId;
  });
  const eligible = candidates
    .filter((p) => p.curseHand.some((c) => canRespondWith(state, p.id, c.curseId, entry)))
    .map((p) => p.id);
  if (eligible.length === 0) return false;
  state.window = { id: state.nextWindowId++, entryId: entry.id, eligible, passed: [], deadline: null, heldBy: null, remainingMs: 0 };
  return true;
}

/**
 * Works through the stack: each entry first gets a reaction window, then resolves when it is on top.
 * Stops while a window is open or a player owes a choice; call again once that is settled.
 */
export function continueResolution(state: GameState, rng: Rng): void {
  for (;;) {
    if (state.turn.phase === 'gameOver') {
      state.stack = [];
      state.window = null;
      return;
    }
    if (state.window || state.pendingChoice) return;
    const top = topEntry(state);
    if (!top) return;
    if (!top.windowDone && !top.canceled) {
      top.windowDone = true;
      if (openWindow(state, top)) return;
      continue;
    }
    state.stack.pop();
    resolveEntry(state, top, rng);
  }
}

function resolveEntry(state: GameState, entry: StackEntry, rng: Rng): void {
  switch (entry.kind) {
    case 'moment':
      return;
    case 'attack': {
      if (entry.canceled) return log(state, 'attackCanceled', entry.playerId, { targetId: entry.targetId });
      const target = getPlayer(state, entry.targetId)!;
      if (target.eliminated || !target.structures.some((s) => s.id === entry.structureCardId)) {
        return log(state, 'attackFizzled', entry.playerId, { targetId: entry.targetId });
      }
      destroyStructure(state, entry.targetId, entry.structureCardId, entry.playerId, rng);
      return;
    }
    case 'ritual': {
      if (entry.canceled) return;
      const performer = getPlayer(state, entry.playerId)!;
      performer.counters.ritualsPerformed++;
      if (state.curseDeck.length === 0) {
        if (state.curseDiscard.length === 0) return log(state, 'ritualEmpty', entry.playerId);
        state.curseDeck = shuffle(rng, state.curseDiscard);
        state.curseDiscard = [];
        log(state, 'curseDeckReshuffled');
      }
      const receiver = getPlayer(state, entry.interceptedBy ?? entry.playerId)!;
      receiver.curseHand.push(state.curseDeck.pop()!);
      if (entry.interceptedBy) log(state, 'curseIntercepted', entry.interceptedBy, { from: entry.playerId });
      return;
    }
    case 'calamity': {
      const player = getPlayer(state, entry.playerId)!;
      if (state.expedition?.playerId !== player.id) return log(state, 'calamityFizzled', player.id, { calamityId: entry.calamityId });
      if (entry.canceled) return log(state, 'calamityPrevented', player.id, { calamityId: entry.calamityId });
      applyCalamity(state, player, state.config.expedition.calamities.find((c) => c.id === entry.calamityId)!, rng);
      return;
    }
    case 'eliminate':
      eliminatePlayer(state, entry.targetId, rng, entry.revived);
      return;
    case 'curse': {
      if (entry.canceled) return log(state, 'curseCanceled', entry.playerId, { curseId: entry.curseId });
      const prepared = prepareCurse(state, entry.playerId, entry.curseId, entry.target, entry.entryId, rng);
      if ('error' in prepared) return log(state, 'curseFizzled', entry.playerId, { curseId: entry.curseId, reason: prepared.error });
      prepared.apply();
      return;
    }
  }
}

function checkWindow(state: GameState, windowId: number): Result {
  if (!state.window || state.window.id !== windowId) return fail('That reaction window has closed');
  return ok;
}

function closeCurrentWindow(state: GameState, rng: Rng): void {
  state.window = null;
  continueResolution(state, rng);
}

/** Sets the countdown of a newly opened window. The server calls this after every move. */
export function stampWindow(state: GameState, now: number): void {
  if (state.window && state.window.deadline === null) state.window.deadline = now + state.config.reactions.windowSeconds * 1000;
}

/** A player declines to respond. The window closes early once every eligible player has passed. */
export function passWindow(state: GameState, playerId: string, windowId: number, rng: Rng, now = 0): Result {
  const check = checkWindow(state, windowId);
  if (!check.ok) return check;
  const window = state.window!;
  if (!window.eligible.includes(playerId)) return fail('You have nothing to respond with');
  if (!window.passed.includes(playerId)) window.passed.push(playerId);
  if (window.heldBy === playerId) releaseWindow(state, playerId, windowId, now);
  if (window.eligible.every((id) => window.passed.includes(id))) closeCurrentWindow(state, rng);
  return ok;
}

/** Pauses the countdown while a player picks targets for a response. */
export function holdWindow(state: GameState, playerId: string, windowId: number, now: number): Result {
  const check = checkWindow(state, windowId);
  if (!check.ok) return check;
  const window = state.window!;
  if (!window.eligible.includes(playerId) || window.passed.includes(playerId)) return fail('You cannot respond to this');
  if (window.heldBy) return fail('Another player is already responding');
  stampWindow(state, now);
  if (now >= window.deadline!) return fail('Too late to respond');
  window.heldBy = playerId;
  window.remainingMs = window.deadline! - now;
  window.deadline = now + (state.config.reactions.holdSeconds ?? 30) * 1000;
  return ok;
}

/** Restarts the countdown after a hold, with at least a second left for the others. */
export function releaseWindow(state: GameState, playerId: string, windowId: number, now: number): Result {
  const check = checkWindow(state, windowId);
  if (!check.ok) return check;
  const window = state.window!;
  if (window.heldBy !== playerId) return fail('You are not holding this window');
  window.heldBy = null;
  window.deadline = now + Math.max(window.remainingMs, 1000);
  window.remainingMs = 0;
  return ok;
}

/** Closes a window whose countdown (or hold) has run out. Any player may ask. */
export function closeWindow(state: GameState, windowId: number, now: number, rng: Rng): Result {
  const check = checkWindow(state, windowId);
  if (!check.ok) return check;
  const deadline = state.window!.deadline;
  if (deadline === null || now < deadline) return fail('The reaction window is still open');
  closeCurrentWindow(state, rng);
  return ok;
}
