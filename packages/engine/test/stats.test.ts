import { describe, expect, it } from 'vitest';
import { buildStructure, drawExpeditionCard, endActionPhase, endMatch, eventsCsv, gameStats, guessProphecy, playCurse, stopExpedition, summaryRow } from '../src';
import { cal, give, newGame, passTurn, res, rng, stackDeck } from './helpers';

describe('game stats', () => {
  it('counts expeditions, Calamities, builds and Prophecies from the log', () => {
    const state = newGame();
    const [p0, p1] = state.players;
    const r = rng();
    // p0: a three-card expedition ending in a Calamity after an ignored first-card Calamity.
    endActionPhase(state, 'p0');
    stackDeck(state, [cal('discard-expedition'), res('grain'), cal('discard-expedition')]);
    for (let i = 0; i < 3; i++) drawExpeditionCard(state, 'p0', r);
    // p1 builds a Farm, then stops after one card.
    give(p1!, 'buildingMaterials', 8);
    give(p1!, 'grain', 2);
    const farm = state.shop.findIndex((c) => c?.structureId === 'farm');
    if (farm >= 0) buildStructure(state, 'p1', farm, r);
    passTurn(state);
    // p2 plays Prophecy Disruption on p0.
    state.players[2]!.curseHand.push({ id: 'pd', curseId: 'prophecy-disruption' });
    playCurse(state, 'p2', 'pd', { playerId: 'p0' }, r);
    passTurn(state);
    // p0 guesses p1's Prophecy correctly.
    p0!.divineCoins = 1;
    guessProphecy(state, 'p0', 'p1', p1!.prophecyId, r);

    const stats = gameStats(state);
    expect(stats.expeditions.count).toBe(3);
    expect(stats.expeditions.endedBy).toEqual({ stopped: 2, calamity: 1, interrupted: 0 });
    expect(stats.expeditions.firstCardCalamitiesIgnored).toBe(1);
    expect(stats.expeditions.calamitiesTriggered).toBe(1);
    expect(stats.expeditions.lengths['3-4']).toBe(1);
    if (farm >= 0) {
      expect(stats.structures.builtByCategory.agricultural).toBe(1);
      expect(stats.structures.averageOwnTurnOfFirstBuild.agricultural).toBe(1);
    }
    expect(stats.prophecies.filter((p) => p.player === p0!.name).map((p) => p.outcome)).toEqual(['replaced', 'held']);
    expect(stats.prophecies.find((p) => p.player === p1!.name)!.outcome).toBe('eliminated');
    expect(stats.players.find((p) => p.name === p0!.name)).toMatchObject({ guesses: 1, correctGuesses: 1, ownTurns: 2 });
    expect(stats.curses.find((c) => c.curse === 'Prophecy Disruption')!.played).toBe(1);
  });

  it('notes privately when a Prophecy becomes met', () => {
    const state = newGame();
    const p0 = state.players[0]!;
    p0.prophecyId = 'wealthy-merchant';
    give(p0, 'purpleDye', 8);
    passTurn(state);
    const met = state.log.find((e) => e.type === 'prophecyMet');
    expect(met).toMatchObject({ playerId: 'p0', private: true });
    expect(gameStats(state).prophecies.find((p) => p.player === p0.name)?.metOnTurn).toBe(1);
  });

  it('exports the log as CSV and a summary row', () => {
    const state = newGame();
    endActionPhase(state, 'p0');
    stackDeck(state, [res('grain')]);
    drawExpeditionCard(state, 'p0', rng());
    stopExpedition(state, 'p0', rng());
    const csv = eventsCsv(state).trim().split('\n');
    expect(csv[0]).toBe('seq,time,turn,type,player,private,details');
    expect(csv).toHaveLength(state.log.length + 1);
    expect(summaryRow('m1', gameStats(state))).toMatchObject({ match: 'm1', players: 3, expeditions: 1, finished: false });
  });
});

describe('ending a game early', () => {
  it('ends the game without a winner and says who ended it', () => {
    const state = newGame();
    endActionPhase(state, 'p0');
    expect(endMatch(state, 'p1')).toEqual({ ok: true });
    expect(state.turn.phase).toBe('gameOver');
    expect(state.winnerId).toBeFalsy();
    expect(state.log.at(-1)).toMatchObject({ type: 'matchEnded', playerId: 'p1', data: { by: 'p1' } });
    expect(gameStats(state).summary).toMatchObject({ finished: true, winner: null, reason: 'ended by Player 1' });
    expect(endMatch(state, 'admin').ok).toBe(false);
  });

  it('only lets players in the game, the admin or the idle timer end it', () => {
    const state = newGame();
    expect(endMatch(state, 'p9').ok).toBe(false);
    expect(endMatch(state, 'idle').ok).toBe(true);
    expect(gameStats(state).summary.reason).toBe('ended by inactivity');
  });
});
