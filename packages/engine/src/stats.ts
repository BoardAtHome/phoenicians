import { STRUCTURE_CATEGORIES, type StructureCategory } from './config/types';
import { inventorySize } from './inventory';
import type { GameEvent, GameState } from './state';

/** One stretch of a player holding one Prophecy. */
export interface ProphecyStint {
  player: string;
  prophecy: string;
  fromTurn: number;
  /** Game turn when it was first met; null if never. */
  metOnTurn: number | null;
  outcome: 'won' | 'replaced' | 'replacedWhileMet' | 'eliminated' | 'held';
  endTurn: number;
}

export interface CurseStats {
  curse: string;
  stars: number;
  played: number;
  /** Played in a reaction window, in answer to something. */
  asAnswer: number;
  canceled: number;
  fizzled: number;
  /** Reaction windows in which a player could have played it. */
  offered: number;
}

export interface PlayerStats {
  name: string;
  ownTurns: number;
  built: number;
  destroyedCredit: number;
  rituals: number;
  cursesPlayed: number;
  divineCoinsBought: number;
  guesses: number;
  correctGuesses: number;
  eliminated: boolean;
  revived: number;
  prophecy: string;
  inventoryAtEnd: number;
}

/** Playtest numbers for one game, matching the scenario list in the Playtesting Guide. */
export interface GameStats {
  summary: {
    finished: boolean;
    players: number;
    turns: number;
    /** Turns divided by players, rounded to one decimal. */
    rounds: number;
    winner: string | null;
    winningProphecy: string | null;
    reason: string | null;
    configVersion: string;
    build: string;
    startedAt: number | null;
    endedAt: number | null;
    minutes: number | null;
  };
  expeditions: {
    count: number;
    averageDraws: number;
    averageKept: number;
    mostKept: number;
    /** How many expeditions had 1, 2, 3–4, 5–7 or 8+ draws. */
    lengths: Record<string, number>;
    endedBy: { stopped: number; calamity: number; interrupted: number };
    firstCardCalamitiesIgnored: number;
    calamitiesTriggered: number;
    calamitiesPrevented: number;
  };
  structures: {
    builtByCategory: Record<StructureCategory, number>;
    /** Average of each player's own-turn number when they first bought that category. */
    averageOwnTurnOfFirstBuild: Record<StructureCategory, number | null>;
    destroyedByAttack: number;
    destroyedByCurse: number;
    turnsWithoutBuild: number;
    marketManipulations: number;
  };
  prophecies: ProphecyStint[];
  curses: CurseStats[];
  reactions: { windows: number; closedByPass: number; closedByTimer: number; answered: number; longestChain: number };
  players: PlayerStats[];
}

const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;
const average = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

/** Works out the playtest stats from a game's full (server-side) state and log. */
export function gameStats(state: GameState): GameStats {
  const nameOf = (id: string | undefined) => state.players.find((p) => p.id === id)?.name ?? String(id);
  const prophecyName = (id: unknown) => state.config.prophecies.find((p) => p.id === id)?.name ?? String(id);
  // Games ended before this build only logged the admin.
  const endedByName = (by: unknown) =>
    by === 'idle' ? 'inactivity' : by === 'admin' || by === undefined ? 'admin' : (state.players.find((p) => p.id === by)?.name ?? String(by));
  const categoryOf = (structureId: unknown) => state.config.structures.find((s) => s.id === structureId)?.category;

  const ownTurns: Record<string, number> = {};
  const firstBuild: Record<string, Partial<Record<StructureCategory, number>>> = {};
  const players: Record<string, PlayerStats> = Object.fromEntries(
    state.players.map((p) => [
      p.id,
      {
        name: p.name,
        ownTurns: 0,
        built: 0,
        destroyedCredit: p.counters.structuresDestroyed,
        rituals: p.counters.ritualsPerformed,
        cursesPlayed: 0,
        divineCoinsBought: 0,
        guesses: 0,
        correctGuesses: 0,
        eliminated: p.eliminated,
        revived: 0,
        prophecy: prophecyName(p.prophecyId),
        inventoryAtEnd: inventorySize(p.inventory),
      },
    ]),
  );
  const curses: Record<string, CurseStats> = Object.fromEntries(
    state.config.curses.map((c) => [c.id, { curse: c.name, stars: c.stars, played: 0, asAnswer: 0, canceled: 0, fizzled: 0, offered: 0 }]),
  );
  const built = Object.fromEntries(STRUCTURE_CATEGORIES.map((c) => [c, 0])) as Record<StructureCategory, number>;
  const expeditions: { draws: number; kept: number; reason: string }[] = [];
  const stints: ProphecyStint[] = [];
  const openStint: Record<string, ProphecyStint> = {};
  let firstCardIgnored = 0;
  let calamitiesTriggered = 0;
  let calamitiesPrevented = 0;
  let destroyedByAttack = 0;
  let destroyedByCurse = 0;
  let marketManipulations = 0;
  let turnsWithoutBuild = 0;
  let builtThisTurn = false;
  let windows = 0;
  let closedByPass = 0;
  let closedByTimer = 0;
  let answered = 0;
  let chain = 0;
  let longestChain = 0;
  let lastAttack = false;

  const closeStint = (playerId: string, outcome: ProphecyStint['outcome'], turn: number) => {
    const stint = openStint[playerId];
    if (!stint) return;
    stint.outcome = outcome;
    stint.endTurn = turn;
    delete openStint[playerId];
  };

  state.log.forEach((e: GameEvent, i) => {
    const d = e.data ?? {};
    const pid = e.playerId ?? '';
    if (e.type !== 'cursePlayed' && !e.private && e.type !== 'windowClosed') chain = 0;
    switch (e.type) {
      case 'gameStarted':
        if (typeof d.firstPlayer === 'string') ownTurns[d.firstPlayer] = 1;
        break;
      case 'turnStarted':
        if (i > 0 && !builtThisTurn) turnsWithoutBuild++;
        builtThisTurn = false;
        ownTurns[pid] = (ownTurns[pid] ?? 0) + 1;
        break;
      case 'prophecyDealt': {
        const stint: ProphecyStint = { player: nameOf(pid), prophecy: prophecyName(d.prophecyId), fromTurn: e.turn, metOnTurn: null, outcome: 'held', endTurn: state.turn.number };
        stints.push(stint);
        openStint[pid] = stint;
        break;
      }
      case 'prophecyMet':
        if (openStint[pid] && openStint[pid]!.metOnTurn === null) openStint[pid]!.metOnTurn = e.turn;
        break;
      case 'prophecyChanged': {
        closeStint(pid, d.wasMet ? 'replacedWhileMet' : 'replaced', e.turn);
        const stint: ProphecyStint = { player: nameOf(pid), prophecy: prophecyName(d.to), fromTurn: e.turn, metOnTurn: null, outcome: 'held', endTurn: state.turn.number };
        stints.push(stint);
        openStint[pid] = stint;
        break;
      }
      case 'playerEliminated':
        closeStint(pid, 'eliminated', e.turn);
        break;
      case 'playerRevived':
        players[pid]!.revived++;
        break;
      case 'gameWon':
        closeStint(pid, 'won', e.turn);
        break;
      case 'structureBuilt': {
        builtThisTurn = true;
        players[pid]!.built++;
        const category = categoryOf(d.structureId);
        if (category) {
          built[category]++;
          const mine = (firstBuild[pid] ??= {});
          mine[category] ??= ownTurns[pid] ?? 1;
        }
        break;
      }
      case 'attacked':
        lastAttack = true;
        break;
      case 'structureDestroyed':
        if (lastAttack) destroyedByAttack++;
        else destroyedByCurse++;
        lastAttack = false;
        break;
      case 'attackCanceled':
      case 'attackFizzled':
        lastAttack = false;
        break;
      case 'expeditionEnded':
        expeditions.push({ draws: Number(d.draws ?? 0), kept: Number(d.kept ?? 0), reason: String(d.reason ?? 'stopped') });
        break;
      case 'calamityIgnored':
        firstCardIgnored++;
        break;
      case 'calamityApplied':
        calamitiesTriggered++;
        break;
      case 'calamityPrevented':
        calamitiesPrevented++;
        break;
      case 'cursePlayed': {
        players[pid]!.cursesPlayed++;
        const stats = curses[String(d.curseId)];
        if (stats) {
          stats.played++;
          if (d.answering) stats.asAnswer++;
        }
        if (d.curseId === 'market-manipulation') marketManipulations++;
        if (d.answering) {
          answered++;
          chain = d.answering === 'curse' ? chain + 1 : 1;
          longestChain = Math.max(longestChain, chain);
        } else chain = 0;
        break;
      }
      case 'curseCanceled':
        if (curses[String(d.curseId)]) curses[String(d.curseId)]!.canceled++;
        break;
      case 'curseFizzled':
        if (curses[String(d.curseId)]) curses[String(d.curseId)]!.fizzled++;
        break;
      case 'windowOpened': {
        windows++;
        const offered = (d.offered ?? {}) as Record<string, string[]>;
        for (const ids of Object.values(offered)) for (const id of ids) if (curses[id]) curses[id]!.offered++;
        break;
      }
      case 'windowClosed':
        if (d.how === 'passed') closedByPass++;
        else closedByTimer++;
        break;
      case 'divineCoinBought':
        players[pid]!.divineCoinsBought++;
        break;
      case 'prophecyGuessed':
        players[pid]!.guesses++;
        if (d.correct) players[pid]!.correctGuesses++;
        break;
    }
  });

  for (const [id, p] of Object.entries(players)) p.ownTurns = ownTurns[id] ?? 0;
  const lengthBucket = (n: number) => (n <= 1 ? '1' : n === 2 ? '2' : n <= 4 ? '3-4' : n <= 7 ? '5-7' : '8+');
  const lengths: Record<string, number> = { '1': 0, '2': 0, '3-4': 0, '5-7': 0, '8+': 0 };
  for (const x of expeditions) lengths[lengthBucket(x.draws)]!++;
  const firstBuildAverage = Object.fromEntries(
    STRUCTURE_CATEGORIES.map((c) => {
      const turns = Object.values(firstBuild).flatMap((m) => (m[c] === undefined ? [] : [m[c]!]));
      return [c, turns.length ? average(turns) : null];
    }),
  ) as Record<StructureCategory, number | null>;

  const times = state.log.map((e) => e.at).filter((t): t is number => typeof t === 'number');
  const startedAt = times.length ? times[0]! : null;
  const endedAt = times.length ? times[times.length - 1]! : null;
  const won = state.log.find((e) => e.type === 'gameWon');
  const ended = state.log.find((e) => e.type === 'matchEnded');
  const winner = state.winnerId ? state.players.find((p) => p.id === state.winnerId)! : null;

  return {
    summary: {
      finished: state.turn.phase === 'gameOver',
      players: state.players.length,
      turns: state.turn.number,
      rounds: round(state.turn.number / state.players.length),
      winner: winner?.name ?? null,
      winningProphecy: winner ? prophecyName(won?.data?.prophecyId ?? winner.prophecyId) : null,
      reason: won ? String(won.data?.reason) : state.turn.phase === 'gameOver' ? `ended by ${endedByName(ended?.data?.by)}` : null,
      configVersion: state.meta?.configVersion ?? 'unknown',
      build: state.meta?.build ?? 'unknown',
      startedAt,
      endedAt,
      minutes: startedAt !== null && endedAt !== null ? round((endedAt - startedAt) / 60000) : null,
    },
    expeditions: {
      count: expeditions.length,
      averageDraws: average(expeditions.map((x) => x.draws)),
      averageKept: average(expeditions.map((x) => x.kept)),
      mostKept: Math.max(0, ...expeditions.map((x) => x.kept)),
      lengths,
      endedBy: {
        stopped: expeditions.filter((x) => x.reason === 'stopped').length,
        calamity: expeditions.filter((x) => x.reason === 'calamity').length,
        interrupted: expeditions.filter((x) => x.reason === 'interrupted').length,
      },
      firstCardCalamitiesIgnored: firstCardIgnored,
      calamitiesTriggered,
      calamitiesPrevented,
    },
    structures: {
      builtByCategory: built,
      averageOwnTurnOfFirstBuild: firstBuildAverage,
      destroyedByAttack,
      destroyedByCurse,
      turnsWithoutBuild,
      marketManipulations,
    },
    prophecies: stints,
    curses: state.config.curses.filter((c) => c.copies > 0 || curses[c.id]!.played > 0).map((c) => curses[c.id]!),
    reactions: { windows, closedByPass, closedByTimer, answered, longestChain },
    players: Object.values(players),
  };
}

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
export const toCsv = (rows: unknown[][]): string => rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';

/** The full event log, one row per event, for a spreadsheet. */
export function eventsCsv(state: GameState): string {
  const name = (id: string | undefined) => (id ? (state.players.find((p) => p.id === id)?.name ?? id) : '');
  return toCsv([
    ['seq', 'time', 'turn', 'type', 'player', 'private', 'details'],
    ...state.log.map((e, i) => [i + 1, e.at ? new Date(e.at).toISOString() : '', e.turn, e.type, name(e.playerId), e.private ? 'yes' : '', e.data ?? '']),
  ]);
}

/** Column names and values for a one-row-per-game summary across many games. */
export function summaryRow(matchID: string, stats: GameStats): Record<string, unknown> {
  const s = stats.summary;
  const x = stats.expeditions;
  const st = stats.structures;
  return {
    match: matchID,
    started: s.startedAt ? new Date(s.startedAt).toISOString() : '',
    minutes: s.minutes,
    configVersion: s.configVersion,
    build: s.build,
    players: s.players,
    turns: s.turns,
    rounds: s.rounds,
    finished: s.finished,
    winner: s.winner,
    winningProphecy: s.winningProphecy,
    reason: s.reason,
    expeditions: x.count,
    avgDraws: x.averageDraws,
    avgKept: x.averageKept,
    stoppedByChoice: x.endedBy.stopped,
    endedByCalamity: x.endedBy.calamity,
    interrupted: x.endedBy.interrupted,
    firstCardCalamitiesIgnored: x.firstCardCalamitiesIgnored,
    calamitiesTriggered: x.calamitiesTriggered,
    ...Object.fromEntries(STRUCTURE_CATEGORIES.map((c) => [`built_${c}`, st.builtByCategory[c]])),
    ...Object.fromEntries(STRUCTURE_CATEGORIES.map((c) => [`firstBuildTurn_${c}`, st.averageOwnTurnOfFirstBuild[c]])),
    destroyedByAttack: st.destroyedByAttack,
    destroyedByCurse: st.destroyedByCurse,
    turnsWithoutBuild: st.turnsWithoutBuild,
    marketManipulations: st.marketManipulations,
    prophecyDisruptions: stats.prophecies.filter((p) => p.outcome.startsWith('replaced')).length,
    disruptedWhileMet: stats.prophecies.filter((p) => p.outcome === 'replacedWhileMet').length,
    cursesPlayed: stats.curses.reduce((n, c) => n + c.played, 0),
    reactionWindows: stats.reactions.windows,
    reactionsAnswered: stats.reactions.answered,
    longestChain: stats.reactions.longestChain,
  };
}
