import { useEffect, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { PlayerViewState } from '@phoenicians/game';
import { describeEvent, describeEntry } from '../format';
import { ActionsSheet, GuessSheet } from './Actions';
import { Center } from './Center';
import { CursePlaySheet, CursesSheet, DiscardSheet, ForcedAttackSheet, ForesightSheet, ReactionLayer } from './Curses';
import { Dock } from './Dock';
import { GuideSheet, type GuideTab } from './Guide';
import { Icon } from './Icon';
import { MarketSheet } from './Market';
import { GameOverSheet, MenuSheet } from './Menu';
import { Seat } from './Seat';
import { Sheet } from './Sheet';
import { lastIndex, seatColor, seating, useTurn } from './useTurn';
import { VillageSheet } from './Village';
import './table.css';

type Overlay = { kind: 'village'; playerId: string } | { kind: 'log' } | { kind: 'curses' } | { kind: 'actions' } | { kind: 'market' } | { kind: 'guess' } | { kind: 'play'; cardId: string } | { kind: 'menu' } | { kind: 'gameOver' } | { kind: 'guide'; tab: GuideTab } | null;

/** The game laid out like a real table: rivals around the edge, the Expedition deck in the middle, your hand at the bottom. */
export function Table({ G, moves, playerID, matchData, inviteLink, onLeave, onStale }: BoardProps<PlayerViewState> & { inviteLink?: string; onLeave?: () => void; onStale?: () => void }) {
  const turn = useTurn({ G, moves, playerID, onStale });
  const { me, active, send, busy, myTurn } = turn;
  const [overlay, setOverlay] = useState<Overlay>(null);
  const close = () => setOverlay(null);
  const help = (tab: GuideTab) => setOverlay({ kind: 'guide', tab });
  // Attack mode: rivals' seats are ringed until you pick one or cancel.
  const [attacking, setAttacking] = useState(false);
  useEffect(() => {
    if (!turn.canAct && !busy) setAttacking(false);
  }, [turn.canAct, busy]);
  useEffect(() => setAttacking(false), [G.log.length]);
  useEffect(() => {
    if (G.turn.phase === 'gameOver') setOverlay({ kind: 'gameOver' });
  }, [G.turn.phase]);
  // A reaction you can answer takes over the screen: close whatever sheet was open underneath.
  useEffect(() => {
    if (G.window && me && G.window.eligible.includes(me.id)) setOverlay(null);
  }, [G.window?.id]); // the attack went through, or something else happened
  const isConnected = (id: string) => matchData?.find((m) => String(m.id) === id)?.isConnected ?? false;

  const seats = seating(G, me?.id);
  const pending = G.pendingChoice;
  const phase = G.turn.phase === 'expedition' ? 'Expedition' : 'Actions';
  const turnText =
    G.turn.phase === 'gameOver' ? 'Game over' : myTurn ? `Your turn · ${phase}` : `${active.name}'s turn · ${phase}`;

  const lastEvent = G.log[lastIndex(G.log, (e) => describeEvent(G, e))];
  const waitingOn = pending && pending.playerId !== playerID ? G.players.find((p) => p.id === pending.playerId)?.name : undefined;
  const seat = (p: (typeof G.players)[number], variant: 'wide' | 'narrow') => (
    <Seat
      key={p.id}
      G={G}
      player={p}
      variant={variant}
      connected={isConnected(p.id)}
      targeting={attacking && !p.eliminated && p.structures.length > 0}
      onClick={() => setOverlay({ kind: 'village', playerId: p.id })}
    />
  );
  const playing = overlay?.kind === 'play' ? me?.curseHand.find((c) => c.id === overlay.cardId) : undefined;
  const villageOf = overlay?.kind === 'village' ? G.players.find((p) => p.id === overlay.playerId) : undefined;

  // The newest event, or the reaction window, sits on top of your dock so it is always in view.
  const news = G.window ? (
    <ReactionLayer key={G.window.id} G={G} turn={turn} moves={moves as never} />
  ) : (
    <button type="button" className="ticker" onClick={() => setOverlay({ kind: 'log' })}>
      {waitingOn
        ? `Waiting for ${waitingOn} to ${pending!.kind === 'discardInventory' ? 'choose cards to discard' : pending!.kind === 'arrangeExpedition' ? 'arrange the Expedition deck' : 'choose a structure to attack'}…`
        : G.stack.length > 0
          ? describeEntry(G, G.stack[G.stack.length - 1]!, playerID ?? undefined)
          : lastEvent && describeEvent(G, lastEvent)}
    </button>
  );

  return (
    <div className="table">
      <div className="table-top">
        <button type="button" className="round-btn" onClick={() => setOverlay({ kind: 'menu' })} aria-label="Game menu">
          <Icon name="menu" />
        </button>
        <span className="turn-pill">
          <span className="dot on" style={{ background: seatColor(G, active.id) }} />
          {turnText}
        </span>
        <span className="top-right">
          <span className="muted small">T{G.turn.number}</span>
          <button type="button" className="round-btn" onClick={() => help('Basics')} aria-label="How to play" title="How to play">
            <Icon name="help" />
          </button>
        </span>
      </div>

      {attacking ? (
        <div className="market-bar attack-bar">
          <Icon name="attack" /> <b>Tap a rival, then pick a structure</b>
          <button type="button" className="grow-right small-btn" onClick={() => setAttacking(false)}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="market-bar" onClick={() => setOverlay({ kind: 'market' })}>
          <Icon name="shop" /> <b>Market</b>
          <span className="market-squares">
            {G.shop.map((card, i) => {
              const s = card && G.config.structures.find((x) => x.id === card.structureId);
              return <span key={card?.id ?? i} className={`chip sq tiny ${s ? `bg-${s.category}` : 'empty'}`} />;
            })}
          </span>
          <span className="muted small grow-right">{G.counts.buildingDeck} in deck</span>
          <Icon name="chev" />
        </button>
      )}

      <div className={`felt seats-${seats.top.length + seats.left.length + seats.right.length}`}>
        <div className="seat-row" style={{ gridTemplateColumns: `repeat(${Math.max(1, seats.top.length)}, minmax(0, 1fr))` }}>
          {seats.top.map((p) => seat(p, seats.top.length >= 3 ? 'narrow' : 'wide'))}
        </div>
        <div className="middle">
          <div className="side">{seats.left.map((p) => seat(p, 'narrow'))}</div>
          <Center G={G} turn={turn} />
          <div className="side">{seats.right.map((p) => seat(p, 'narrow'))}</div>
        </div>
      </div>

      <Dock
        G={G}
        turn={turn}
        top={news}
        onVillage={() => me && setOverlay({ kind: 'village', playerId: me.id })}
        onCurses={() => setOverlay({ kind: 'curses' })}
        onActions={() => setOverlay({ kind: 'actions' })}
      />

      {villageOf && (
        <VillageSheet
          key={villageOf.id}
          G={G}
          player={villageOf}
          turn={turn}
          onClose={close}
        />
      )}
      {overlay?.kind === 'market' && <MarketSheet G={G} turn={turn} onClose={close} onHelp={() => help('Market')} />}
      {overlay?.kind === 'actions' && (
        <ActionsSheet
          G={G}
          turn={turn}
          onClose={close}
          onAttack={() => {
            close();
            setAttacking(true);
          }}
          onGuess={() => setOverlay({ kind: 'guess' })}
          onHelp={() => help('Basics')}
        />
      )}
      {overlay?.kind === 'guess' && <GuessSheet G={G} turn={turn} onClose={close} onHelp={() => help('Prophecies')} />}
      {overlay?.kind === 'menu' && <MenuSheet G={G} inviteLink={inviteLink} onLeave={onLeave} onEnd={me ? () => send('endGame') : undefined} onLog={() => setOverlay({ kind: 'log' })} onGuide={() => help('Basics')} onClose={close} />}
      {overlay?.kind === 'gameOver' && <GameOverSheet G={G} onClose={close} />}
      {overlay?.kind === 'guide' && <GuideSheet key={overlay.tab} config={G.config} initial={overlay.tab} onClose={close} />}
      {overlay?.kind === 'curses' && <CursesSheet G={G} turn={turn} onClose={close} onPlay={(card) => setOverlay({ kind: 'play', cardId: card.id })} onHelp={() => help('Curses')} />}
      {overlay?.kind === 'play' && me && playing && (
        <CursePlaySheet
          key={playing.id}
          G={G}
          me={me}
          card={playing}
          onBack={() => setOverlay({ kind: 'curses' })}
          onPlay={(target) => {
            send('playCurse', playing.id, target);
            close();
          }}
        />
      )}

      {/* Choices the game is waiting on come last so they sit above everything else. */}
      {pending?.kind === 'arrangeExpedition' && pending.playerId === playerID && G.foresight.length > 0 && (
        <ForesightSheet key={G.foresight.map((c) => c.id).join()} G={G} turn={turn} />
      )}
      {pending?.kind === 'forcedAttack' && pending.playerId === playerID && <ForcedAttackSheet G={G} turn={turn} targetId={pending.targetId} />}
      {pending?.kind === 'discardInventory' && me && pending.playerId === me.id && <DiscardSheet G={G} turn={turn} me={me} />}
      {overlay?.kind === 'log' && (
        <Sheet title="Activity" onClose={close}>
          <ol className="log-list">
            {G.log
              .map((e, i) => ({ text: describeEvent(G, e), i }))
              .filter((x) => x.text)
              .reverse()
              .map((x) => <li key={x.i}>{x.text}</li>)}
          </ol>
        </Sheet>
      )}
    </div>
  );
}
