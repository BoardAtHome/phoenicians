import { useEffect, useState } from 'react';
import { prophecyProgress, type Player } from '@phoenicians/engine';
import { HIDDEN, type PlayerViewState } from '@phoenicians/game';
import { evaluationHelp, prophecyGoal, prophecyHow } from '../help';
import { Icon } from './Icon';
import { CategoryCounts } from './Seat';
import type { Turn } from './useTurn';
import { ResourceTiles } from './Village';

/** Your secret Prophecy, hidden until you tap it. Hides again when you leave the page. */
function ProphecyBar({ G, me }: { G: PlayerViewState; me: Player }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const hide = () => document.hidden && setOpen(false);
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  const prophecy = me.prophecyId !== HIDDEN ? G.config.prophecies.find((p) => p.id === me.prophecyId) : undefined;
  if (!prophecy) return null;
  const progress = prophecyProgress(G, me, prophecy);
  const met = !me.eliminated && progress >= prophecy.threshold;
  return (
    <button type="button" className={`prophecy-bar ${met ? 'met' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} title={open ? evaluationHelp(prophecy) : undefined}>
      <Icon name={open ? 'eye' : 'lock'} size={18} />
      <span className="prophecy-text">
        <span className="label">Secret Prophecy</span>
        {open ? (
          <>
            <b>{prophecy.name}: {prophecyGoal(prophecy)}</b>
            <span className="small">
              {Math.min(progress, prophecy.threshold)} / {prophecy.threshold}
              {' · '}
              {prophecy.evaluation === 'cumulative' ? 'stays achieved once reached' : 'must still hold at your turn start'}
            </span>
            <span className="small muted">{prophecyHow(G.config, prophecy)}</span>
          </>
        ) : (
          <b>Tap to peek · your secret goal to win</b>
        )}
      </span>
      {open && (
        <span className="progress" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (progress / prophecy.threshold) * 100)}%` }} />
        </span>
      )}
    </button>
  );
}

/** Your hand: Prophecy, resources, village, Curses, coins and the main buttons for this moment. */
export function Dock({
  G,
  turn,
  top,
  onVillage,
  onCurses,
  onActions,
}: {
  G: PlayerViewState;
  turn: Turn;
  top: React.ReactNode;
  onVillage: () => void;
  onCurses: () => void;
  onActions: () => void;
}) {
  const { me, active, send, canAct, exploring, canStop, noCardsLeft, myTurn } = turn;
  if (!me) return null;
  const kept = G.expedition?.drawn.length ?? 0;

  let buttons: React.ReactNode;
  if (G.turn.phase === 'gameOver') {
    buttons = <div className="waiting-bar">The game is over</div>;
  } else if (myTurn && G.turn.phase === 'action') {
    buttons = (
      <>
        <button type="button" className="big outline" disabled={!canAct} onClick={onActions}>
          <Icon name="grid" /> Actions
        </button>
        <button type="button" className="big primary" disabled={!canAct} onClick={() => send('endActions')}>
          <Icon name="ship" /> Set out
        </button>
      </>
    );
  } else if (myTurn && G.turn.phase === 'expedition') {
    buttons = (
      <>
        <button type="button" className="big outline" disabled={!canStop} onClick={() => send('stopExpedition')}>
          Keep {kept}
        </button>
        <button type="button" className="big primary" disabled={!exploring || noCardsLeft} onClick={() => send('draw')}>
          Draw a card
        </button>
      </>
    );
  } else {
    buttons = (
      <div className="waiting-bar">
        {me.eliminated ? (me.reviving ? 'You return at your next turn' : 'You are out of the game') : G.turn.phase === 'expedition' ? `${active.name} is exploring…` : `Waiting for ${active.name}…`}
      </div>
    );
  }

  return (
    <div className="dock">
      {top}
      <ProphecyBar G={G} me={me} />
      <ResourceTiles player={me} config={G.config} />
      <div className="strip">
        <button type="button" className="strip-btn grow" onClick={onVillage} aria-label="Your village">
          <CategoryCounts G={G} player={me} />
        </button>
        <button type="button" className="strip-btn" onClick={onCurses} aria-label="Your Curses" title="Your Curses: secret cards with special powers">
          <Icon name="curse" /> {me.curseHand.length}
        </button>
        <span className="strip-btn coins" title={`Divine Coins: spend ${G.config.costs.guessProphecy} to guess a rival's Prophecy`}>
          <Icon name="coin" /> {me.divineCoins}
        </span>
      </div>
      {me.constructionBanned && <p className="hint small">A Construction Ban stops you building this turn.</p>}
      {me.constructionBans > 0 && <p className="hint small">You are under a Construction Ban for your next turn.</p>}
      <div className="buttons">{buttons}</div>
    </div>
  );
}
