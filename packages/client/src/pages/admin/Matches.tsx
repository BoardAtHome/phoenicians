import { useEffect, useState } from 'react';
import { STRUCTURE_CATEGORIES, type GameStats } from '@phoenicians/engine';
import { ApiError, api, type MatchDetail, type MatchSummary } from '../../api';
import { Link } from '../../App';
import { CATEGORY_LABEL, describeEvent } from '../../format';

const PHASE: Record<string, string> = { action: 'Actions', expedition: 'Expedition', gameOver: 'Finished' };
const OUTCOME: Record<string, string> = {
  won: 'Won',
  replaced: 'Replaced',
  replacedWhileMet: 'Replaced while met',
  eliminated: 'Eliminated',
  held: 'Still held',
};

/** Every match on the server, with stats, downloads and controls for stuck games. */
export function Matches() {
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const refresh = () =>
    api
      .matches()
      .then((m) => setMatches(m.matches))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load matches'));
  useEffect(() => {
    void refresh();
  }, []);

  if (!matches) return <section className="panel">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}</section>;

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="row spread">
          <h2>Matches ({matches.length})</h2>
          <div className="row">
            <button onClick={() => void refresh()}>Refresh</button>
            <button disabled={matches.length === 0} onClick={() => api.downloadSummary().catch((e: Error) => setError(e.message))}>
              Download all games (CSV)
            </button>
          </div>
        </div>
        <p className="muted small">One row per game, for comparing configs in a spreadsheet. Open a match for its stats, full log and controls.</p>
        {error && <p className="error">{error}</p>}
        {matches.length === 0 && <p className="muted">No matches yet.</p>}
        <table className="form-table matches">
          <thead><tr><th>Started</th><th>Players</th><th>Turn</th><th>State</th><th>Config</th><th /></tr></thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.matchID} className={open === m.matchID ? 'selected' : ''}>
                <td className="small">{new Date(m.createdAt).toLocaleString()}</td>
                <td>{m.players.map((p) => p.name).join(', ')}</td>
                <td>{m.turn}</td>
                <td>{m.phase === 'gameOver' ? (m.winner ? `${m.winner} won` : 'Ended') : `${m.activePlayer}: ${PHASE[m.phase] ?? m.phase}`}</td>
                <td className="small">{m.configVersion} · {m.build}</td>
                <td><button onClick={() => setOpen(open === m.matchID ? null : m.matchID)}>{open === m.matchID ? 'Close' : 'Open'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {open && <MatchDetails key={open} matchID={open} onChange={refresh} />}
    </div>
  );
}

function MatchDetails({ matchID, onChange }: { matchID: string; onChange: () => void }) {
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => api.match(matchID).then(setDetail).catch((err) => setError(err instanceof Error ? err.message : 'Could not load'));
  useEffect(() => {
    void load();
  }, [matchID]);

  async function act(action: () => Promise<unknown>, success: string) {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await load();
      onChange();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (!detail) return <section className="panel">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}</section>;
  const { summary, stats, G } = detail;
  const over = summary.phase === 'gameOver';
  const recent = G.log.filter((e) => !e.private).slice(-6).reverse();

  return (
    <section className="panel stack">
      <div className="row spread">
        <h2>Match {matchID}</h2>
        <Link to={`/match/${matchID}`}>Open the board</Link>
      </div>
      <div className="row">
        <button onClick={() => api.downloadLog(matchID).catch((e: Error) => setError(e.message))}>Download log (CSV)</button>
        <button onClick={() => api.downloadJson(matchID).catch((e: Error) => setError(e.message))}>Download everything (JSON)</button>
        <button
          disabled={summary.undoDepth === 0}
          title={summary.undoDepth === 0 ? 'Only actions since the server last started can be undone' : undefined}
          onClick={() => window.confirm('Undo the last action in this match?') && void act(() => api.undoMatch(matchID), 'Undone. Players see the change straight away.')}
        >
          Undo last action{summary.undoDepth > 0 ? ` (${summary.undoDepth} available)` : ''}
        </button>
        <button
          className="danger"
          disabled={over}
          onClick={() => window.confirm('End this match for everyone? It cannot be resumed (but Undo can bring it back).') && void act(() => api.endMatch(matchID), 'The match has ended.')}
        >
          End match
        </button>
      </div>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div>
        <h3>Last actions</h3>
        <ol className="small">{recent.map((e, i) => <li key={i}>{describeEvent(G, e) ?? e.type}</li>)}</ol>
      </div>
      <StatsView stats={stats} />
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number | null)[][] }) {
  return (
    <table className="form-table stats">
      <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c ?? '–'}</td>)}</tr>)}</tbody>
    </table>
  );
}

/** The playtest numbers, grouped like the scenario list in the Playtesting Guide. */
export function StatsView({ stats }: { stats: GameStats }) {
  const s = stats.summary;
  const x = stats.expeditions;
  const st = stats.structures;
  const r = stats.reactions;
  return (
    <div className="stats-view stack">
      <h3>Game</h3>
      <p className="small">
        {s.players} players · {s.turns} turns ({s.rounds} rounds){s.minutes !== null && ` · ${s.minutes} minutes`} · config {s.configVersion} · build {s.build}
        <br />
        {s.finished ? (s.winner ? `${s.winner} won with ${s.winningProphecy} (${s.reason === 'prophecy' ? 'Prophecy' : 'last player standing'}).` : 'Ended without a winner.') : 'Still in progress.'}
      </p>

      <h3>Expeditions</h3>
      <Table
        head={['Expeditions', 'Avg draws', 'Avg kept', 'Best haul', 'Stopped', 'Calamity', 'Interrupted', 'First-card Calamities ignored', 'Calamities hit', 'Prevented']}
        rows={[[x.count, x.averageDraws, x.averageKept, x.mostKept, x.endedBy.stopped, x.endedBy.calamity, x.endedBy.interrupted, x.firstCardCalamitiesIgnored, x.calamitiesTriggered, x.calamitiesPrevented]]}
      />
      <Table head={['Draws per expedition', ...Object.keys(x.lengths)]} rows={[['Expeditions', ...Object.values(x.lengths)]]} />

      <h3>Buildings and shop</h3>
      <Table
        head={['Category', 'Built', 'Avg own turn of first purchase']}
        rows={STRUCTURE_CATEGORIES.map((c) => [CATEGORY_LABEL[c], st.builtByCategory[c], st.averageOwnTurnOfFirstBuild[c]])}
      />
      <p className="small">
        Destroyed by attacks {st.destroyedByAttack}, by Curses {st.destroyedByCurse} · Turns with no building bought {st.turnsWithoutBuild} · Market Manipulations {st.marketManipulations}
      </p>

      <h3>Prophecies</h3>
      <Table
        head={['Player', 'Prophecy', 'Held from turn', 'First met on turn', 'Outcome', 'Until turn']}
        rows={stats.prophecies.map((p) => [p.player, p.prophecy, p.fromTurn, p.metOnTurn, OUTCOME[p.outcome] ?? p.outcome, p.endTurn])}
      />

      <h3>Curses</h3>
      <Table
        head={['Curse', 'Stars', 'Played', 'As a response', 'Canceled', 'No effect', 'Could have been played']}
        rows={stats.curses.map((c) => [c.curse, '★'.repeat(c.stars), c.played, c.asAnswer, c.canceled, c.fizzled, c.offered])}
      />
      <p className="small">
        Reaction windows {r.windows} · closed when all passed {r.closedByPass} · by the timer {r.closedByTimer} · responses {r.answered} · longest counter-Curse chain {r.longestChain}
      </p>

      <h3>Players</h3>
      <Table
        head={['Player', 'Own turns', 'Built', 'Destroyed', 'Rituals', 'Curses', 'Coins bought', 'Guesses (right)', 'Revived', 'Out', 'Cards at end']}
        rows={stats.players.map((p) => [p.name, p.ownTurns, p.built, p.destroyedCredit, p.rituals, p.cursesPlayed, p.divineCoinsBought, `${p.guesses} (${p.correctGuesses})`, p.revived, p.eliminated ? 'yes' : '', p.inventoryAtEnd])}
      />
    </div>
  );
}
