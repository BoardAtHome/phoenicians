import { useEffect, useRef, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import {
  RESOURCES,
  canAfford,
  inventoryCounts,
  inventorySize,
  prophecyProgress,
  type Player,
  type ResourceMap,
  type StructureConfig,
} from '@phoenicians/engine';
import { HIDDEN, type PlayerViewState } from '@phoenicians/game';
import { CATEGORY_LABEL, RESOURCE_LABEL, costText, describeEvent } from '../format';
import { CurseHand, ForcedAttackDialog, ForesightDialog } from './Curses';

type Props = BoardProps<PlayerViewState>;

const emptySelection = (): ResourceMap => ({ buildingMaterials: 0, warriors: 0, grain: 0, purpleDye: 0 });

function Resources({ player }: { player: Player }) {
  const counts = inventoryCounts(player.inventory);
  return (
    <div className="resources">
      {RESOURCES.map((r) => (
        <span key={r} className={`res res-${r}`} title={RESOURCE_LABEL[r]}>
          {RESOURCE_LABEL[r]} <b>{counts[r]}</b>
        </span>
      ))}
    </div>
  );
}

export function Board({ G, moves, playerID, matchData }: Props) {
  const [attacking, setAttacking] = useState(false);
  const [guessTarget, setGuessTarget] = useState('');
  const [guessProphecy, setGuessProphecy] = useState('');
  const [discard, setDiscard] = useState<ResourceMap>(emptySelection);

  // One move at a time: the server rejects a move sent before the previous one's
  // result arrives, so buttons stay disabled until the new state comes back.
  const [busy, setBusy] = useState(false);
  const busyTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    setBusy(false);
    clearTimeout(busyTimer.current);
  }, [G]);
  const send = (name: string, ...args: unknown[]) => {
    if (busy) return;
    setBusy(true);
    busyTimer.current = setTimeout(() => setBusy(false), 3000);
    moves[name]!(...args);
  };

  const me = G.players.find((p) => p.id === playerID);
  const active = G.players.find((p) => p.id === G.turn.activePlayerId)!;
  const opponents = G.players.filter((p) => p.id !== playerID);
  const structure = (id: string) => G.config.structures.find((s) => s.id === id)!;
  const isConnected = (id: string) => matchData?.find((m) => String(m.id) === id)?.isConnected ?? false;

  const myTurn = !!me && G.turn.activePlayerId === me.id && G.turn.phase !== 'gameOver';
  const canAct = myTurn && G.turn.phase === 'action' && !G.pendingChoice && !busy;
  const exploring = myTurn && G.turn.phase === 'expedition' && !G.pendingChoice && !busy;
  const pending = G.pendingChoice;
  const winner = G.winnerId ? G.players.find((p) => p.id === G.winnerId) : null;
  const costs = G.config.costs;
  const noCardsLeft = G.counts.expeditionDeck === 0 && G.expeditionDiscard.length === 0;
  const canStop = exploring && G.expedition && ((G.expedition.drawCount > 0 && G.expedition.lastDrawWasResource) || noCardsLeft);

  const prophecy = me && me.prophecyId !== HIDDEN ? G.config.prophecies.find((p) => p.id === me.prophecyId) : undefined;

  const statusText = winner
    ? `${winner.name} won the game.`
    : pending
      ? `Waiting for ${G.players.find((p) => p.id === pending.playerId)?.name} to ${
          pending.kind === 'discardInventory' ? 'choose cards to discard' : pending.kind === 'arrangeExpedition' ? 'arrange the Expedition deck' : 'choose a structure to attack'
        }.`
      : G.turn.phase === 'expedition'
        ? `${active.name} is on an expedition.`
        : `${active.name} is taking actions.`;

  return (
    <div className="board">
      <div className={`status ${myTurn ? 'mine' : ''}`}>
        <div>
          <strong>{myTurn ? 'Your turn' : statusText}</strong>
          {myTurn && <span className="muted"> · {G.turn.phase === 'action' ? 'Build, attack, perform rituals, then set out' : 'Draw or stop'}</span>}
        </div>
        <div className="muted small">
          Turn {G.turn.number} · Expedition deck {G.counts.expeditionDeck} · Buildings {G.counts.buildingDeck} · Curses {G.counts.curseDeck}
          {G.meta && <> · Config {G.meta.configVersion} · Build {G.meta.build}</>}
        </div>
      </div>

      {winner && (
        <div className="banner">
          <h2>{winner.id === playerID ? 'You win!' : `${winner.name} wins`}</h2>
          <p>{describeEvent(G, G.log[G.log.length - 1]!)}</p>
        </div>
      )}

      {pending?.kind === 'arrangeExpedition' && pending.playerId === playerID && G.foresight.length > 0 && (
        <ForesightDialog key={G.foresight.map((c) => c.id).join()} G={G} send={send} busy={busy} />
      )}
      {pending?.kind === 'forcedAttack' && pending.playerId === playerID && <ForcedAttackDialog G={G} targetId={pending.targetId} send={send} busy={busy} />}

      {pending?.kind === 'discardInventory' && me && pending.playerId === me.id && (
        <div className="panel dialog">
          <h3>Choose {pending.count} cards to discard</h3>
          <p className="muted small">
            {pending.source.type === 'calamity'
              ? `Calamity: ${G.config.expedition.calamities.find((c) => c.id === (pending.source as { calamityId: string }).calamityId)?.name}`
              : 'Structural Burden: one card per structure you own.'}
          </p>
          <div className="steppers">
            {RESOURCES.map((r) => (
              <label key={r}>
                {RESOURCE_LABEL[r]} ({me.inventory[r].length})
                <input
                  type="number"
                  min={0}
                  max={me.inventory[r].length}
                  value={discard[r]}
                  onChange={(e) => setDiscard({ ...discard, [r]: Math.max(0, Math.min(me.inventory[r].length, Number(e.target.value))) })}
                />
              </label>
            ))}
          </div>
          <button
            className="primary"
            disabled={busy || RESOURCES.reduce((n, r) => n + discard[r], 0) !== pending.count}
            onClick={() => {
              send('chooseDiscard', discard);
              setDiscard(emptySelection());
            }}
          >
            Discard {RESOURCES.reduce((n, r) => n + discard[r], 0)} / {pending.count}
          </button>
        </div>
      )}

      <div className="columns">
        <div className="stack">
          <section className="panel">
            <h3>Shop</h3>
            <div className="shop">
              {G.shop.map((card, slot) => {
                if (!card) return <div key={slot} className="card empty">Empty</div>;
                const s = structure(card.structureId);
                const affordable = !!me && canAfford(me.inventory, s.cost) && !me.constructionBanned;
                return (
                  <div key={card.id} className={`card cat-${s.category}`}>
                    <div className="card-title">{s.name}</div>
                    <div className="muted small">{CATEGORY_LABEL[s.category]}</div>
                    <div className="small">{costText(s.cost)}</div>
                    <button disabled={!canAct || !affordable} onClick={() => send('build', slot)}>Build</button>
                  </div>
                );
              })}
            </div>
          </section>

          {G.expedition && (
            <section className="panel expedition">
              <h3>{G.expedition.playerId === playerID ? 'Your expedition' : `${active.name}'s expedition`}</h3>
              <div className="drawn">
                {G.expedition.drawn.length === 0 && <span className="muted">No resources yet.</span>}
                {G.expedition.drawn.map((c) => (
                  <span key={c.id} className={`res res-${c.resource}`}>{RESOURCE_LABEL[c.resource]}</span>
                ))}
              </div>
              <p className="muted small">
                {G.expedition.drawCount} card{G.expedition.drawCount === 1 ? '' : 's'} drawn. The first card can't trigger a Calamity; later ones end the expedition.
              </p>
              {G.expedition.playerId === playerID && (
                <div className="row">
                  <button className="primary" disabled={!exploring || noCardsLeft} onClick={() => send('draw')}>Draw a card</button>
                  <button disabled={!canStop} onClick={() => send('stopExpedition')}>Stop and keep</button>
                </div>
              )}
            </section>
          )}

          {me && (
            <section className="panel">
              <div className="row spread">
                <h3>Your village</h3>
                <span className="small">Divine Coins <b>{me.divineCoins}</b></span>
              </div>
              <Resources player={me} />
              <Village player={me} structure={structure} />
              {prophecy && (
                <div className="prophecy">
                  <span className="muted small">Your secret Prophecy</span>
                  <strong>{prophecy.name}</strong>
                  <span className="small">
                    {prophecyProgress(G, me, prophecy)} / {prophecy.threshold} · {prophecy.evaluation === 'cumulative' ? 'stays achieved once reached' : 'must still hold at your turn start'}
                  </span>
                </div>
              )}

              <div className="actions">
                <button disabled={!canAct || !canAfford(me.inventory, costs.ritual)} onClick={() => send('ritual')}>
                  Ritual <span className="small">({costText(costs.ritual)})</span>
                </button>
                <button disabled={!canAct || !canAfford(me.inventory, costs.divineCoin)} onClick={() => send('buyDivineCoin')}>
                  Buy Divine Coin <span className="small">({costText(costs.divineCoin)})</span>
                </button>
                <button
                  className={attacking ? 'active' : ''}
                  disabled={!canAct || !canAfford(me.inventory, costs.attack)}
                  onClick={() => setAttacking(!attacking)}
                >
                  {attacking ? 'Cancel attack' : 'Attack'} <span className="small">({costText(costs.attack)})</span>
                </button>
                <button className="primary" disabled={!canAct} onClick={() => { setAttacking(false); send('endActions'); }}>
                  Set out on expedition
                </button>
              </div>
              {attacking && <p className="hint">Pick an opponent's structure to destroy.</p>}
              {me.constructionBanned && <p className="hint">A Construction Ban stops you building this turn.</p>}
              {me.constructionBans > 0 && <p className="hint">You are under a Construction Ban for your next turn.</p>}

              <div className="guess">
                <span className="small">Guess a Prophecy ({costs.guessProphecy} Divine Coin)</span>
                <select value={guessTarget} onChange={(e) => setGuessTarget(e.target.value)}>
                  <option value="">Player…</option>
                  {opponents.filter((p) => !p.eliminated).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={guessProphecy} onChange={(e) => setGuessProphecy(e.target.value)}>
                  <option value="">Prophecy…</option>
                  {G.config.prophecies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button
                  disabled={!canAct || !guessTarget || !guessProphecy || me.divineCoins < costs.guessProphecy}
                  onClick={() => { send('guessProphecy', guessTarget, guessProphecy); setGuessTarget(''); setGuessProphecy(''); }}
                >
                  Guess
                </button>
              </div>

              <CurseHand G={G} me={me} canAct={canAct} send={send} />
            </section>
          )}
        </div>

        <div className="stack">
          {opponents.map((p) => (
            <section key={p.id} className={`panel opponent ${p.eliminated ? 'out' : ''} ${p.id === G.turn.activePlayerId ? 'current' : ''}`}>
              <div className="row spread">
                <h3>
                  <span className={`dot ${isConnected(p.id) ? 'on' : ''}`} /> {p.name}
                </h3>
                <span className="small muted">
                  {p.eliminated ? `Eliminated · ${G.config.prophecies.find((x) => x.id === p.prophecyId)?.name ?? ''}` : `${p.curseHand.length} curses · ${p.divineCoins} coins · ${inventorySize(p.inventory)} cards`}
                </span>
              </div>
              <Resources player={p} />
              <Village
                player={p}
                structure={structure}
                onAttack={attacking && canAct && !p.eliminated ? (cardId) => { send('attack', p.id, cardId); setAttacking(false); } : undefined}
              />
            </section>
          ))}

          <section className="panel log">
            <h3>Activity</h3>
            <ol>
              {G.log
                .slice(-40)
                .reverse()
                .map((e, i) => {
                  const text = describeEvent(G, e);
                  return text ? <li key={G.log.length - i}>{text}</li> : null;
                })}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function Village({ player, structure, onAttack }: { player: Player; structure: (id: string) => StructureConfig; onAttack?: (cardId: string) => void }) {
  if (player.structures.length === 0) return <p className="muted small">No structures yet.</p>;
  return (
    <div className="village">
      {player.structures.map((card) => {
        const s = structure(card.structureId);
        return (
          <span key={card.id} className={`building cat-${s.category}`}>
            {s.name}
            {onAttack && <button className="danger" onClick={() => onAttack(card.id)}>Destroy</button>}
          </span>
        );
      })}
    </div>
  );
}
