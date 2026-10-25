import { useEffect, useState } from 'react';
import { STRUCTURE_CATEGORIES, type GameStats } from '@phoenicians/engine';
import { ApiError, api, type MatchDetail, type MatchSummary } from '../../api';
import { Link } from '../../App';
import { CATEGORY_LABEL, describeEvent } from '../../format';

const PHASE: Record<string, string> = { action: 'Actions', expedition: 'Expedition', gameOver: 'Finished' };
const IDLE_CHOICES = [1, 3, 12, 24, 72];

/** "Ana won", "Ended by Ben", or whose turn it is and in which phase. */
function stateText(m: MatchSummary) {
  if (m.phase !== 'gameOver') return `${m.activePlayer}: ${PHASE[m.phase] ?? m.phase}`;
  if (m.winner) return `${m.winner} won`;
  if (m.endedBy === 'idle') return 'Ended (inactive)';
  return m.endedBy && m.endedBy !== 'admin' ? `Ended by ${m.endedBy}` : 'Ended by admin';
}

/** "5 min ago", "3 h ago", "2 days ago". */
function ago(ms: number) {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

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
  const [idleHours, setIdleHours] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const [idleChoice, setIdleChoice] = useState(3);

  const refresh = () =>
    api
      .matches()
      .then((m) => {
        setMatches(m.matches);
        setIdleHours(m.idleHours);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load matches'));

  async function act(action: () => Promise<string>) {
    setError('');
    setMessage('');
    try {
      setMessage(await action());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }
  const endOne = (m: MatchSummary) =>
    window.confirm(`End the game with ${m.players.map((p) => p.name).join(', ')} for everyone? No one wins. Its log and stats are kept.`) &&
    void act(async () => {
      await api.endMatch(m.matchID);
      return 'The game has ended.';
    });
  const endIdle = () => {
    const idle = (matches ?? []).filter((m) => m.phase !== 'gameOver' && Date.now() - m.updatedAt > idleChoice * 3_600_000);
    if (idle.length === 0) {
      setError('');
      setMessage(`No game in progress has gone ${idleChoice} h without a move.`);
      return;
    }
    if (!window.confirm(`End ${idle.length} game${idle.length === 1 ? '' : 's'} with no moves for ${idleChoice} hours? Their logs and stats are kept.`)) return;
    void act(async () => {
      const { ended } = await api.endIdleMatches(idleChoice);
      return `Ended ${ended.length} game${ended.length === 1 ? '' : 's'}.`;
    });
  };
  useEffect(() => {
    void refresh();
  }, []);

  if (!matches) return <section className="panel">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}</section>;
  const inProgress = matches.filter((m) => m.phase !== 'gameOver');
  const shown = showFinished ? matches : inProgress;

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
        <div className="row">
          <span>End games in progress with no moves for</span>
          <select value={idleChoice} onChange={(e) => setIdleChoice(Number(e.target.value))}>
            {IDLE_CHOICES.map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
          <button className="danger" disabled={inProgress.length === 0} onClick={endIdle}>End idle games</button>
        </div>
        <p className="muted small">
          {idleHours > 0
            ? `Games with no moves for ${idleHours} hours also end by themselves.`
            : 'Games never end by themselves: IDLE_MATCH_HOURS is set to 0 on the server.'}{' '}
          Players can end their own game from the game menu. Ended games keep their log and stats.
        </p>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <label className="radio">
          <input type="checkbox" checked={showFinished} onChange={(e) => setShowFinished(e.target.checked)} />
          Show finished games ({matches.length - inProgress.length})
        </label>
        {shown.length === 0 && <p className="muted">{matches.length === 0 ? 'No matches yet.' : 'No games in progress.'}</p>}
        {shown.length > 0 && (
          <table className="form-table matches">
            <thead><tr><th>Started</th><th>Players</th><th>Turn</th><th>State</th><th>Last move</th><th>Config</th><th /></tr></thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.matchID} className={open === m.matchID ? 'selected' : ''}>
                  <td className="small">{new Date(m.createdAt).toLocaleString()}</td>
                  <td>{m.players.map((p) => p.name).join(', ')}</td>
                  <td>{m.turn}</td>
                  <td>{stateText(m)}</td>
                  <td className="small">{ago(m.updatedAt)}</td>
                  <td className="small">{m.configVersion} · {m.build}</td>
                  <td className="nowrap">
                    <button onClick={() => setOpen(open === m.matchID ? null : m.matchID)}>{open === m.matchID ? 'Close' : 'Open'}</button>
                    {m.phase !== 'gameOver' && <button className="danger" onClick={() => endOne(m)}>End</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
          onClick={() => window.confirm('End this match for everyone? No one wins. Its log and stats are kept, and Undo can bring it back.') && void act(() => api.endMatch(matchID), 'The match has ended.')}
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
  // In a game still being played, Prophecies and hands are secret; the admin may be a player too.
  const [spoilers, setSpoilers] = useState(stats.summary.finished);
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

      {!spoilers ? (
        <div className="stack">
          <h3>Prophecies and Curses</h3>
          <p className="muted small">Hidden while the game is in progress, since they show players' secret Prophecies and hands.</p>
          <div><button onClick={() => setSpoilers(true)}>Show anyway</button></div>
        </div>
      ) : (
        <>
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
        </>
      )}

      <h3>Players</h3>
      <Table
        head={['Player', 'Own turns', 'Built', 'Destroyed', 'Rituals', 'Curses', 'Coins bought', 'Guesses (right)', 'Revived', 'Out', 'Cards at end']}
        rows={stats.players.map((p) => [p.name, p.ownTurns, p.built, p.destroyedCredit, p.rituals, p.cursesPlayed, p.divineCoinsBought, `${p.guesses} (${p.correctGuesses})`, p.revived, p.eliminated ? 'yes' : '', p.inventoryAtEnd])}
      />
    </div>
  );
}
