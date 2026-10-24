import { beforeEach, describe, expect, it } from 'vitest';
import {
  attack,
  closeWindow,
  drawExpeditionCard,
  endActionPhase,
  guessProphecy,
  holdWindow,
  passWindow,
  performRitual,
  playCurse,
  releaseWindow,
  stampWindow,
  stopExpedition,
  type CurseTarget,
  type GameState,
  type Player,
} from '../src';
import { cal, give, grant, newGame, res, rng, stackDeck } from './helpers';

let state: GameState;
let p0: Player;
let p1: Player;
let p2: Player;
const r = rng();

/** Puts a Curse into a player's hand and returns its card id. */
function hand(player: Player, curseId: string): string {
  const card = { id: `test-${curseId}-${player.id}-${player.curseHand.length}`, curseId };
  player.curseHand.push(card);
  return card.id;
}

function respond(player: Player, curseId: string, target: CurseTarget = {}) {
  return playCurse(state, player.id, hand(player, curseId), target, r);
}

/** Lets the open window run out. */
function expire() {
  const id = state.window!.id;
  stampWindow(state, 0);
  expect(closeWindow(state, id, 1e9, r).ok).toBe(true);
}

/** Runs out every window until the stack is settled. */
function settle() {
  while (state.window) expire();
}

beforeEach(() => {
  state = newGame(3, 42, { reactions: true });
  [p0, p1, p2] = state.players as [Player, Player, Player];
  for (const p of state.players) {
    state.curseDiscard.push(...p.curseHand.splice(0));
  }
});

describe('reaction windows', () => {
  it('open after a draw for players holding a Curse they could play, and block the explorer meanwhile', () => {
    hand(p1, 'petty-theft');
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain'), res('grain')]);
    expect(drawExpeditionCard(state, 'p0', r).ok).toBe(true);
    expect(state.window).toMatchObject({ eligible: ['p1'], passed: [] });
    expect(drawExpeditionCard(state, 'p0', r).ok).toBe(false);
    expect(stopExpedition(state, 'p0', r).ok).toBe(false);
  });

  it('do not open when nobody holds a usable Curse', () => {
    hand(p1, 'attack-negation'); // only answers attacks
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain')]);
    drawExpeditionCard(state, 'p0', r);
    expect(state.window).toBeNull();
    expect(state.stack).toHaveLength(0);
  });

  it('close as soon as every eligible player passes', () => {
    hand(p1, 'petty-theft');
    hand(p2, 'mass-theft');
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain')]);
    drawExpeditionCard(state, 'p0', r);
    const id = state.window!.id;
    expect(passWindow(state, 'p0', id, r).ok).toBe(false);
    passWindow(state, 'p1', id, r);
    expect(state.window).not.toBeNull();
    passWindow(state, 'p2', id, r);
    expect(state.window).toBeNull();
    expect(stopExpedition(state, 'p0', r).ok).toBe(true);
  });

  it('cannot be closed before the countdown ends, and a hold pauses the countdown', () => {
    hand(p1, 'petty-theft');
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain')]);
    drawExpeditionCard(state, 'p0', r);
    const id = state.window!.id;
    stampWindow(state, 1000);
    expect(state.window!.deadline).toBe(6000);
    expect(closeWindow(state, id, 5999, r).ok).toBe(false);

    expect(holdWindow(state, 'p1', id, 3000).ok).toBe(true);
    expect(state.window).toMatchObject({ heldBy: 'p1', remainingMs: 3000, deadline: 33000 });
    expect(closeWindow(state, id, 6000, r).ok).toBe(false);
    expect(releaseWindow(state, 'p1', id, 10000).ok).toBe(true);
    expect(state.window!.deadline).toBe(13000);
    expect(closeWindow(state, id, 13000, r).ok).toBe(true);
  });

  it('let other players play ordinary Curses outside their turn', () => {
    give(p0, 'grain', 3);
    hand(p1, 'petty-theft');
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain')]);
    drawExpeditionCard(state, 'p0', r);
    expect(respond(p1, 'petty-theft', { playerId: 'p0' }).ok).toBe(true);
    settle();
    expect(p1.inventory.grain).toHaveLength(2);
  });

  it('refuse reactive Curses outside a window', () => {
    expect(respond(p0, 'attack-negation').ok).toBe(false);
  });
});

describe('reactive Curses', () => {
  beforeEach(() => {
    grant(state, p1, 'farm');
    give(p0, 'warriors', 3);
  });

  it('Attack Negation cancels an attack; the attacker still pays', () => {
    hand(p1, 'attack-negation');
    attack(state, 'p0', 'p1', p1.structures[0]!.id, r);
    expect(p1.structures).toHaveLength(1);
    expect(state.window?.eligible).toEqual(['p1']);
    expect(respond(p1, 'attack-negation').ok).toBe(true);
    settle();
    expect(p1.structures).toHaveLength(1);
    expect(p0.inventory.warriors).toHaveLength(0);
    expect(state.log.some((e) => e.type === 'attackCanceled')).toBe(true);
  });

  it('an attack nobody answers destroys the structure once the window runs out', () => {
    hand(p2, 'attack-negation');
    attack(state, 'p0', 'p1', p1.structures[0]!.id, r);
    expect(p1.structures).toHaveLength(1);
    expire();
    expect(p1.structures).toHaveLength(0);
    expect(p0.counters.structuresDestroyed).toBe(1);
  });

  it('Curse Negation answers a Curse played against you, and can be chained', () => {
    hand(p1, 'attack-negation');
    hand(p0, 'curse-negation');
    attack(state, 'p0', 'p1', p1.structures[0]!.id, r);
    respond(p1, 'attack-negation');
    expect(state.window?.eligible).toEqual(['p0']);
    expect(respond(p0, 'curse-negation').ok).toBe(true);
    settle();
    expect(p1.structures).toHaveLength(0);
  });

  it('Curse Negation stops an ordinary Curse', () => {
    give(p1, 'grain', 2);
    hand(p1, 'curse-negation');
    respond(p0, 'petty-theft', { playerId: 'p1' });
    expect(state.window?.eligible).toEqual(['p1']);
    respond(p1, 'curse-negation');
    settle();
    expect(p1.inventory.grain).toHaveLength(2);
    expect(state.log.some((e) => e.type === 'curseCanceled')).toBe(true);
  });

  it('Curse Negation only answers Curses aimed at you', () => {
    hand(p2, 'curse-negation');
    hand(p2, 'petty-theft');
    respond(p0, 'petty-theft', { playerId: 'p1' });
    expect(respond(p2, 'curse-negation').ok).toBe(false);
  });

  it('Divine Interception takes the Curse from a ritual; the ritual still counts for the performer', () => {
    give(p0, 'grain', 4);
    hand(p1, 'divine-interception');
    const before = p0.curseHand.length;
    performRitual(state, 'p0', r);
    respond(p1, 'divine-interception');
    settle();
    expect(p0.curseHand).toHaveLength(before);
    expect(p1.curseHand).toHaveLength(2); // the spare copy plus the intercepted Curse
    expect(p0.counters.ritualsPerformed).toBe(1);
  });

  it('Calamity Protection lets the explorer ignore a Calamity and keep going', () => {
    hand(p0, 'calamity-protection');
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain'), cal('discard-expedition'), res('warriors')]);
    drawExpeditionCard(state, 'p0', r);
    drawExpeditionCard(state, 'p0', r);
    expect(state.window?.eligible).toEqual(['p0']);
    expect(respond(p0, 'calamity-protection').ok).toBe(true);
    settle();
    expect(state.expedition?.drawn).toHaveLength(1);
    expect(drawExpeditionCard(state, 'p0', r).ok).toBe(true);
    expect(state.expedition?.drawn).toHaveLength(2);
  });

  it('an unanswered Calamity strikes when its window runs out', () => {
    hand(p0, 'calamity-protection');
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain'), cal('discard-expedition')]);
    drawExpeditionCard(state, 'p0', r);
    drawExpeditionCard(state, 'p0', r);
    expire();
    expect(state.turn.activePlayerId).toBe('p1');
    expect(p0.inventory.grain).toHaveLength(0);
  });

  it('Expedition Interruption ends the expedition; the explorer keeps what they drew', () => {
    hand(p1, 'expedition-interruption');
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain'), res('grain')]);
    drawExpeditionCard(state, 'p0', r);
    expect(respond(p1, 'expedition-interruption').ok).toBe(true);
    settle();
    expect(p0.inventory.grain).toHaveLength(1);
    expect(state.turn.activePlayerId).toBe('p1');
    expect(state.stack).toHaveLength(0);
  });

  it('Expedition Theft takes everything drawn so far; the expedition goes on', () => {
    hand(p1, 'expedition-theft');
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain'), res('warriors'), res('grain')]);
    drawExpeditionCard(state, 'p0', r);
    expire();
    drawExpeditionCard(state, 'p0', r);
    respond(p1, 'expedition-theft');
    settle();
    expect(p1.inventory.grain).toHaveLength(1);
    expect(p1.inventory.warriors).toHaveLength(1);
    expect(state.expedition?.drawn).toHaveLength(0);
    expect(state.turn.activePlayerId).toBe('p0');
  });

  it('Forced Exploration makes the explorer draw three more before stopping', () => {
    hand(p1, 'forced-exploration');
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain'), res('grain'), res('grain'), res('grain')]);
    drawExpeditionCard(state, 'p0', r);
    respond(p1, 'forced-exploration');
    settle();
    expect(stopExpedition(state, 'p0', r).ok).toBe(false);
    for (let i = 0; i < 3; i++) {
      expect(stopExpedition(state, 'p0', r).ok).toBe(false);
      drawExpeditionCard(state, 'p0', r);
      settle();
    }
    expect(stopExpedition(state, 'p0', r).ok).toBe(true);
    expect(p0.inventory.grain).toHaveLength(4);
  });

  it('Revival brings an eliminated player back at their next turn with one Building Material', () => {
    p0.divineCoins = state.config.costs.guessProphecy;
    hand(p1, 'revival');
    hand(p2, 'petty-theft'); // only the target may answer an elimination
    const oldProphecy = p1.prophecyId;
    guessProphecy(state, 'p0', 'p1', oldProphecy, r);
    expect(state.window?.eligible).toEqual(['p1']);
    respond(p1, 'revival');
    settle();
    expect(p1).toMatchObject({ eliminated: true, reviving: true });
    expect(state.winnerId).toBeNull();

    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain')]);
    drawExpeditionCard(state, 'p0', r);
    settle();
    stopExpedition(state, 'p0', r);
    expect(state.turn.activePlayerId).toBe('p1');
    expect(p1).toMatchObject({ eliminated: false, reviving: false });
    expect(p1.inventory.buildingMaterials).toHaveLength(1);
    expect(p1.prophecyId).toBeTruthy();
  });

  it('a correct guess without Revival eliminates at once', () => {
    p0.divineCoins = state.config.costs.guessProphecy;
    guessProphecy(state, 'p0', 'p1', p1.prophecyId, r);
    expect(p1.eliminated).toBe(true);
  });
});

describe('Extra Expedition outside your turn', () => {
  it('runs right after the current turn, then play continues as normal', () => {
    hand(p2, 'extra-expedition');
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain'), res('warriors'), res('purpleDye')]);
    drawExpeditionCard(state, 'p0', r);
    respond(p2, 'extra-expedition');
    settle();
    stopExpedition(state, 'p0', r);

    expect(state.turn).toMatchObject({ activePlayerId: 'p2', phase: 'expedition', resumeAfter: 'p0' });
    drawExpeditionCard(state, 'p2', r);
    stopExpedition(state, 'p2', r);
    expect(p2.inventory.warriors).toHaveLength(1);
    expect(state.turn).toMatchObject({ activePlayerId: 'p1', phase: 'action' });
    expect(state.turn.resumeAfter).toBeUndefined();
  });
});
