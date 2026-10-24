import { useState } from 'react';
import { HIDDEN, type PlayerViewState } from '@phoenicians/game';
import { Link } from '../App';
import { describeEvent } from '../format';
import { Icon } from './Icon';
import { Avatar } from './Seat';
import { Sheet } from './Sheet';
import { lastIndex } from './useTurn';

/** Invite link, leave seat, the activity log, and what version of the rules this game uses. */
export function MenuSheet({ G, inviteLink, onLeave, onLog, onClose }: { G: PlayerViewState; inviteLink?: string; onLeave?: () => void; onLog: () => void; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Sheet title="Game menu" onClose={onClose}>
      {inviteLink && (
        <>
          <div className="section-label"><span>Invite link</span></div>
          <div className="row">
            <code className="grow">{inviteLink}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(inviteLink).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </>
      )}
      <button type="button" className="row-card" onClick={onLog}>
        <Icon name="cards" /> <span className="grow">Activity log</span> <Icon name="chev" />
      </button>
      <Link to="/changelog" className="row-card">
        <Icon name="grid" /> <span className="grow">Rule and balance changes</span> <Icon name="chev" />
      </Link>
      <div className="section-label"><span>This game</span></div>
      <p className="small muted">
        Turn {G.turn.number} · Expedition deck {G.counts.expeditionDeck} · Buildings {G.counts.buildingDeck} · Curses {G.counts.curseDeck}
        {G.meta && <> · Config {G.meta.configVersion} · Build {G.meta.build}</>}
      </p>
      {onLeave && (
        <button type="button" className="big outline" onClick={onLeave}>
          Leave seat
        </button>
      )}
    </Sheet>
  );
}

/** The winner, and every Prophecy revealed. */
export function GameOverSheet({ G, onClose }: { G: PlayerViewState; onClose: () => void }) {
  const winner = G.players.find((p) => p.id === G.winnerId);
  const won = lastIndex(G.log, (e) => e.type === 'gameWon');
  return (
    <Sheet title={winner ? `${winner.name} wins` : 'Game over'} subtitle={won >= 0 ? describeEvent(G, G.log[won]!) : 'The admin ended this game.'} onClose={onClose}>
      <div className="section-label"><span>Prophecies</span></div>
      {G.players.map((p) => {
        const prophecy = p.prophecyId !== HIDDEN ? G.config.prophecies.find((x) => x.id === p.prophecyId) : undefined;
        return (
          <div key={p.id} className={`row-card ${p.id === G.winnerId ? 'winner' : ''}`}>
            <Avatar G={G} player={p} size={30} />
            <span className="row-main">
              <b>{p.name}{p.eliminated ? ' (out)' : ''}</b>
              <span className="small">{prophecy?.name ?? 'Hidden'}</span>
            </span>
            {p.id === G.winnerId && <Icon name="curse" />}
          </div>
        );
      })}
    </Sheet>
  );
}
