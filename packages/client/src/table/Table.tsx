import { useEffect, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { PlayerViewState } from '@phoenicians/game';
import { describeEvent, describeEntry } from '../format';
import { CurseHand, DiscardDialog, ForcedAttackDialog, ForesightDialog } from '../board/Curses';
import { ReactionBar } from '../board/Reactions';
import { ActionsSheet, GuessSheet } from './Actions';
import { Center } from './Center';
import { Dock } from './Dock';
import { Icon } from './Icon';
import { MarketSheet } from './Market';
import { Seat } from './Seat';
import { Sheet } from './Sheet';
import { lastIndex, seatColor, seating, useTurn } from './useTurn';
import { VillageSheet } from './Village';
import './table.css';

type Overlay = { kind: 'village'; playerId: string } | { kind: 'log' } | { kind: 'curses' } | { kind: 'actions' } | { kind: 'market' } | { kind: 'guess' } | null;

/** The game laid out like a real table: rivals around the edge, the Expedition deck in the middle, your hand at the bottom. */
export function Table({ G, moves, playerID, matchData }: BoardProps<PlayerViewState>) {
  const turn = useTurn({ G, moves, playerID });
  const { me, active, send, busy, myTurn } = turn;
  const [overlay, setOverlay] = useState<Overlay>(null);
  const close = () => setOverlay(null);
  // Attack mode: rivals' seats are ringed until you pick one or cancel.
  const [attacking, setAttacking] = useState(false);
  useEffect(() => {
    if (!turn.canAct && !busy) setAttacking(false);
  }, [turn.canAct, busy]);
  useEffect(() => setAttacking(false), [G.log.length]); // the attack went through, or something else happened
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
  const villageOf = overlay?.kind === 'village' ? G.players.find((p) => p.id === overlay.playerId) : undefined;

  return (
    <div className="table">
      <div className="table-top">
        <span className="turn-pill">
          <span className="dot on" style={{ background: seatColor(G, active.id) }} />
          {turnText}
        </span>
        <span className="muted small">T{G.turn.number}</span>
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

      {G.window ? (
        <ReactionBar key={G.window.id} G={G} me={me} send={send} moves={moves as never} busy={busy} />
      ) : (
        <button type="button" className="ticker" onClick={() => setOverlay({ kind: 'log' })}>
          {waitingOn
            ? `Waiting for ${waitingOn} to ${pending!.kind === 'discardInventory' ? 'choose cards to discard' : pending!.kind === 'arrangeExpedition' ? 'arrange the Expedition deck' : 'choose a structure to attack'}…`
            : G.stack.length > 0
              ? describeEntry(G, G.stack[G.stack.length - 1]!)
              : lastEvent && describeEvent(G, lastEvent)}
        </button>
      )}

      {pending?.kind === 'arrangeExpedition' && pending.playerId === playerID && G.foresight.length > 0 && (
        <ForesightDialog key={G.foresight.map((c) => c.id).join()} G={G} send={send} busy={busy} />
      )}
      {pending?.kind === 'forcedAttack' && pending.playerId === playerID && <ForcedAttackDialog G={G} targetId={pending.targetId} send={send} busy={busy} />}
      {pending?.kind === 'discardInventory' && me && pending.playerId === me.id && <DiscardDialog G={G} me={me} send={send} busy={busy} />}

      <Dock
        G={G}
        turn={turn}
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
      {overlay?.kind === 'market' && <MarketSheet G={G} turn={turn} onClose={close} />}
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
        />
      )}
      {overlay?.kind === 'guess' && <GuessSheet G={G} turn={turn} onClose={close} />}
      {overlay?.kind === 'curses' && me && (
        <Sheet title="Your Curses" subtitle={`${me.curseHand.length} in hand`} onClose={close}>
          <CurseHand G={G} me={me} canAct={turn.canAct || turn.exploring} send={send} />
        </Sheet>
      )}
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
