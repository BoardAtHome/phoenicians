import { useEffect, useState } from 'react';
import type { LobbyAPI } from 'boardgame.io';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { Phoenicians, type SetupData } from '@phoenicians/game';
import { getSeat, lobby, saveSeat, SERVER, type Seat } from '../api';
import { Board } from '../board/Board';

const GameClient = Client({ game: Phoenicians, board: Board, multiplayer: SocketIO({ server: SERVER }), debug: false });

export function MatchPage({ matchID }: { matchID: string }) {
  const [match, setMatch] = useState<LobbyAPI.Match | null>(null);
  const [error, setError] = useState('');
  const [seat, setSeat] = useState<Seat | null>(() => getSeat(matchID));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () =>
      lobby
        .getMatch('phoenicians', matchID)
        .then((m) => live && setMatch(m))
        .catch(() => live && setError('This game does not exist. It may have ended when the server restarted.'));
    load();
    const timer = setInterval(load, 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [matchID]);

  if (error) return <section className="panel narrow"><p className="error">{error}</p></section>;
  if (!match) return <section className="panel narrow"><p className="muted">Loading…</p></section>;

  const names = (match.setupData as SetupData | undefined)?.names ?? [];
  const link = `${window.location.origin}/match/${matchID}`;

  async function claim(playerID: string) {
    try {
      const { playerCredentials } = await lobby.joinMatch('phoenicians', matchID, { playerID, playerName: names[Number(playerID)] ?? playerID });
      const next = { playerID, credentials: playerCredentials };
      saveSeat(matchID, next);
      setSeat(next);
    } catch {
      setError('That seat was just taken. Reload and pick another.');
    }
  }

  if (seat) {
    return (
      <>
        <div className="sharebar">
          <span className="muted">Invite link:</span> <code>{link}</code>
          <button onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy'}</button>
          <button className="ghost" onClick={() => { saveSeat(matchID, null); setSeat(null); }}>Leave seat</button>
        </div>
        <GameClient matchID={matchID} playerID={seat.playerID} credentials={seat.credentials} />
      </>
    );
  }

  return (
    <section className="panel narrow">
      <h1>Join the game</h1>
      <p className="muted">Share this link with the other players, then pick your name.</p>
      <div className="sharebar inline">
        <code>{link}</code>
        <button onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy link'}</button>
      </div>
      <div className="stack">
        {match.players.map((p) => (
          <button key={p.id} className={p.name ? 'seat taken' : 'seat'} disabled={!!p.name} onClick={() => claim(String(p.id))}>
            {names[p.id] ?? `Player ${p.id + 1}`}
            <span className="muted">{p.name ? (p.isConnected ? 'Playing' : 'Taken') : 'I am this player'}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
