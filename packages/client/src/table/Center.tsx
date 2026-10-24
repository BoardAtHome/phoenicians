import { useEffect, useState } from 'react';
import type { GameEvent } from '@phoenicians/engine';
import type { PlayerViewState } from '@phoenicians/game';
import { describeEvent } from '../format';
import { Icon } from './Icon';
import { lastIndex, type Turn } from './useTurn';

/** The newest log event of one of these types, while it is less than `ms` old on this device. */
function useRecent(G: PlayerViewState, types: string[], ms: number): GameEvent | null {
  const index = lastIndex(G.log, (e) => types.includes(e.type));
  const [shown, setShown] = useState<number>(-1);
  const [seen] = useState(() => index); // events already in the log on first render are old news
  useEffect(() => {
    if (index <= seen) return;
    setShown(index);
    const timer = setTimeout(() => setShown(-1), ms);
    return () => clearTimeout(timer);
  }, [index]);
  return shown >= 0 && shown === index ? G.log[index]! : null;
}

/** Copy for how many cards are still safe from Calamities. */
function safeText(G: PlayerViewState, drawCount: number) {
  const safe = G.config.expedition.ignoredCalamityDraws - drawCount;
  if (drawCount === 0) return safe <= 0 ? 'Any card may be a Calamity' : safe === 1 ? 'First card is safe' : `First ${safe} cards are safe`;
  if (safe > 0) return `${drawCount} drawn · ${safe === 1 ? 'next card is safe' : `next ${safe} cards are safe`}`;
  return `${drawCount} drawn · a Calamity now ends it`;
}

/** The Expedition deck in the middle of the table and what is happening on it. */
export function Center({ G, turn }: { G: PlayerViewState; turn: Turn }) {
  const { me, active, winner } = turn;
  const expedition = G.expedition;
  const explorer = expedition ? G.players.find((p) => p.id === expedition.playerId) : undefined;
  const mine = !!me && explorer?.id === me.id;
  const top = G.stack[G.stack.length - 1];
  const struck = useRecent(G, ['calamityApplied', 'calamityPrevented', 'calamityIgnored'], 4500);
  const calamityName = (id: unknown) => G.config.expedition.calamities.find((c) => c.id === id)?.name ?? String(id);

  let below: React.ReactNode;
  if (G.turn.phase === 'gameOver') {
    below = (
      <div className="alert win">
        <strong>{winner ? (winner.id === me?.id ? 'You win!' : `${winner.name} wins`) : 'Game over'}</strong>
        <span className="small">{winner ? describeEvent(G, G.log[lastIndex(G.log, (e) => e.type === 'gameWon')]!) : 'The admin ended this game.'}</span>
      </div>
    );
  } else if (top?.kind === 'calamity' && !top.canceled) {
    below = (
      <div className="alert danger">
        <Icon name="alert" size={18} />
        <strong>Calamity</strong>
        <span className="small">{calamityName(top.calamityId)}</span>
      </div>
    );
  } else if (struck) {
    const who = G.players.find((p) => p.id === struck.playerId)?.name;
    const name = calamityName(struck.data?.calamityId);
    below = (
      <div className={`alert ${struck.type === 'calamityApplied' ? 'danger' : ''}`}>
        <Icon name="alert" size={18} />
        <strong>{struck.type === 'calamityApplied' ? 'Calamity' : struck.type === 'calamityIgnored' ? 'Calamity ignored' : 'Calamity stopped'}</strong>
        <span className="small">
          {struck.type === 'calamityIgnored' ? `${who}'s first card is safe: "${name}" has no effect.` : struck.type === 'calamityPrevented' ? `${who} was protected from "${name}".` : `${who}: ${name}.`}
        </span>
      </div>
    );
  } else if (expedition && explorer) {
    below = (
      <>
        <div className="drawn-cards">
          {expedition.drawn.map((c) => (
            <span key={c.id} className={`mini-card bg-${c.resource}`}><Icon name={c.resource} size={14} /></span>
          ))}
        </div>
        <span className="caption">{mine ? safeText(G, expedition.drawCount) : `${explorer.name} has drawn ${expedition.drawCount}`}</span>
        {expedition.mustDraw > 0 && (
          <span className="caption hint">Forced Exploration: {expedition.mustDraw} more draw{expedition.mustDraw === 1 ? '' : 's'} before stopping</span>
        )}
      </>
    );
  } else {
    below = <span className="caption">{turn.myTurn ? "Set out when you're done spending" : `${active.name} is taking actions`}</span>;
  }

  return (
    <div className="center">
      <div className="deck" title="Expedition deck">
        <Icon name="ship" size={22} />
        <b>{G.counts.expeditionDeck}</b>
      </div>
      <span className="deck-label">Expedition deck</span>
      {below}
    </div>
  );
}
