import { useEffect, useState } from 'react';
import {
  CURSE_TARGETS,
  RESOURCES,
  REACTIVE_CURSES,
  burdenCount,
  canPlayInWindow,
  sabotageCount,
  curseNoEffectReason,
  topEntry,
  type CurseCard,
  type CurseTarget,
  type Player,
  type Resource,
  type ResourceMap,
  type StackEntry,
} from '@phoenicians/engine';
import type { PlayerViewState } from '@phoenicians/game';
import { useCountdown } from './countdown';
import { CATEGORY_LABEL, RESOURCE_LABEL, describeEntry } from '../format';
import { calamityHelp, curseEffect, curseWhen } from '../help';
import { Icon } from './Icon';
import { Avatar } from './Seat';
import { HelpLink, Sheet } from './Sheet';
import type { Turn } from './useTurn';

type Moves = Record<string, ((...args: unknown[]) => void) | undefined>;

const curseOf = (G: PlayerViewState, curseId: string) => G.config.curses.find((c) => c.id === curseId)!;
const needsTargets = (curseId: string) => (CURSE_TARGETS[curseId] ?? []).length > 0;

/** A Curse card: name, stars, text, and whatever goes on the right. */
function CurseCardView({ G, curseId, children, note }: { G: PlayerViewState; curseId: string; children?: React.ReactNode; note?: string }) {
  const curse = curseOf(G, curseId);
  return (
    <div className="curse-card">
      <div className="row-main">
        <div>
          <b>{curse.name}</b> <span className="stars">{'★'.repeat(curse.stars)}</span>
        </div>
        <span className="small">{curseEffect(G.config, curse)}</span>
        {note && <span className="small hint">{note}</span>}
      </div>
      {children}
    </div>
  );
}

/** Your hand. Ordinary Curses can be played on your turn; reactive ones arrive with reaction windows. */
export function CursesSheet({ G, turn, onClose, onPlay, onHelp }: { G: PlayerViewState; turn: Turn; onClose: () => void; onPlay: (card: CurseCard) => void; onHelp: () => void }) {
  const { me, canAct, exploring, send } = turn;
  if (!me) return null;
  const canPlay = canAct || exploring;
  const limit = G.config.setup.curseHandLimit;
  return (
    <Sheet title="Your Curses" subtitle={`${me.curseHand.length}${limit ? ` / ${limit}` : ''} in hand`} onClose={onClose}>
      {me.curseHand.length === 0 && <p className="muted small">No Curses. Perform a ritual to draw one.</p>}
      {me.curseHand.map((c) =>
        REACTIVE_CURSES.has(c.curseId) ? (
          <CurseCardView key={c.id} G={G} curseId={c.curseId} note={`${curseWhen(c.curseId)} We'll ask you then.`} />
        ) : (
          <CurseCardView key={c.id} G={G} curseId={c.curseId} note={curseNoEffectReason(G, me.id, c.curseId) ?? undefined}>
            <button
              type="button"
              className="primary"
              disabled={!canPlay || !!curseNoEffectReason(G, me.id, c.curseId)}
              onClick={() => {
                if (needsTargets(c.curseId)) onPlay(c);
                else {
                  send('playCurse', c.id, {});
                  onClose();
                }
              }}
            >
              Play
            </button>
          </CurseCardView>
        ),
      )}
      {!canPlay && <p className="muted small">Outside your turn, you'll be offered Curses you can play in a reaction window.</p>}
      <HelpLink onOpen={onHelp} label="Every Curse and what it does" />
    </Sheet>
  );
}

function PlayerPicks({ G, players, me, value, onChange }: { G: PlayerViewState; players: Player[]; me: Player; value?: string; onChange: (id: string) => void }) {
  return (
    <div className="pick-grid players">
      {players.map((p) => (
        <button key={p.id} type="button" className={`pick ${value === p.id ? 'selected' : ''}`} onClick={() => onChange(p.id)} aria-pressed={value === p.id}>
          <Avatar G={G} player={p} size={30} />
          <span className="small">{p.id === me.id ? 'You' : p.name}</span>
        </button>
      ))}
    </div>
  );
}

function ResourcePicks({ value, onChange, options, counts }: { value?: Resource; onChange: (r: Resource) => void; options: readonly Resource[]; counts?: Record<Resource, number> }) {
  return (
    <div className="pick-grid res-grid">
      {RESOURCES.map((r) => (
        <button
          key={r}
          type="button"
          className={`pick res-pick bg-${r} ${value === r ? 'selected' : ''}`}
          disabled={!options.includes(r)}
          onClick={() => onChange(r)}
          aria-pressed={value === r}
        >
          <Icon name={r} />
          <span className="small">{RESOURCE_LABEL[r]}{counts ? ` (${counts[r]})` : ''}</span>
        </button>
      ))}
    </div>
  );
}

/** Choosing targets for a Curse, from your hand or as a response. */
export function CursePlaySheet({ G, me, card, onPlay, onBack }: { G: PlayerViewState; me: Player; card: CurseCard; onPlay: (t: CurseTarget) => void; onBack: () => void }) {
  const fields = CURSE_TARGETS[card.curseId] ?? [];
  const curse = curseOf(G, card.curseId);
  const [target, setTarget] = useState<CurseTarget>({});
  const set = (patch: Partial<CurseTarget>) => setTarget({ ...target, ...patch });

  const live = G.players.filter((p) => !p.eliminated);
  // Only offer targets the Curse would have an effect on.
  const affected = (patch: CurseTarget) => !curseNoEffectReason(G, me.id, card.curseId, { ...target, ...patch });
  const choices = (fields.includes('opponent') ? live.filter((p) => p.id !== me.id) : live).filter((p) => affected({ playerId: p.id, secondPlayerId: undefined, resource: undefined }));
  const chosen = G.players.find((p) => p.id === target.playerId);
  const sabotage = chosen ? sabotageCount(G, chosen) : 0;
  const discardCounts = Object.fromEntries(
    RESOURCES.map((r) => [r, G.expeditionDiscard.filter((c) => c.type === 'resource' && c.resource === r).length]),
  ) as Record<Resource, number>;
  const mine = Object.fromEntries(RESOURCES.map((r) => [r, me.inventory[r].length])) as Record<Resource, number>;

  let ready = true;
  if ((fields.includes('opponent') || fields.includes('player')) && !target.playerId) ready = false;
  if (fields.includes('secondPlayer') && !target.secondPlayerId) ready = false;
  if (fields.includes('resource') && !target.resource) ready = false;
  if (fields.includes('exchange') && (!target.give || !target.take)) ready = false;
  if (fields.includes('structures') && (target.structureCardIds?.length ?? 0) !== sabotage) ready = false;
  const blocked = curseNoEffectReason(G, me.id, card.curseId, target);
  if (blocked) ready = false;

  return (
    <Sheet title={`Play ${curse.name}`} subtitle={curseEffect(G.config, curse)} onClose={onBack}>
      {(fields.includes('opponent') || fields.includes('player')) && (
        <>
          <div className="section-label"><span>{fields.includes('secondPlayer') ? 'Player A (attacks)' : 'Choose a player'}</span></div>
          <PlayerPicks G={G} players={choices} me={me} value={target.playerId} onChange={(id) => set({ playerId: id, structureCardIds: [], secondPlayerId: target.secondPlayerId === id ? undefined : target.secondPlayerId })} />
        </>
      )}
      {fields.includes('secondPlayer') && (
        <>
          <div className="section-label"><span>Player B (is attacked)</span></div>
          <PlayerPicks G={G} players={live.filter((p) => p.id !== target.playerId && affected({ secondPlayerId: p.id }))} me={me} value={target.secondPlayerId} onChange={(id) => set({ secondPlayerId: id })} />
        </>
      )}
      {fields.includes('resource') && (
        <>
          <div className="section-label"><span>Resource</span></div>
          <ResourcePicks value={target.resource} onChange={(r) => set({ resource: r })} options={RESOURCES.filter((r) => affected({ resource: r }))} />
        </>
      )}
      {fields.includes('exchange') && (
        <>
          <div className="section-label"><span>Give from your inventory</span></div>
          <ResourcePicks value={target.give} onChange={(r) => set({ give: r })} options={RESOURCES.filter((r) => mine[r] > 0)} counts={mine} />
          <div className="section-label"><span>Take from the Expedition discard pile</span></div>
          <ResourcePicks value={target.take} onChange={(r) => set({ take: r })} options={RESOURCES.filter((r) => discardCounts[r] > 0)} counts={discardCounts} />
        </>
      )}
      {fields.includes('structures') && chosen && (
        <>
          <div className="section-label">
            <span>Structures to destroy</span>
            <span className="muted">{chosen.name} has {chosen.inventory.warriors.length} Warriors, so {sabotage}</span>
          </div>
          <div className="structures">
            {chosen.structures.map((s) => {
              const on = target.structureCardIds?.includes(s.id) ?? false;
              const structure = G.config.structures.find((x) => x.id === s.structureId)!;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`structure ${on ? 'selected' : ''}`}
                  disabled={!on && (target.structureCardIds?.length ?? 0) >= sabotage}
                  onClick={() => set({ structureCardIds: on ? target.structureCardIds!.filter((x) => x !== s.id) : [...(target.structureCardIds ?? []), s.id] })}
                  aria-pressed={on}
                >
                  <span className={`chip round lg bg-${structure.category}`}><Icon name={structure.category} size={16} /></span>
                  <span className="structure-text">
                    <b>{structure.name}</b>
                    <span className="muted small">{CATEGORY_LABEL[structure.category]}</span>
                  </span>
                  {on && <span className="picked"><Icon name="check" size={14} /></span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      {card.curseId === 'structural-burden' && chosen && (
        <p className="small muted">{chosen.name} will discard {burdenCount(G, chosen)} card(s) of their choice.</p>
      )}
      {blocked && <p className="small hint">{blocked}</p>}
      <button type="button" className="big primary" disabled={!ready} onClick={() => onPlay(target)}>
        <Icon name="curse" /> Play {curse.name}
      </button>
    </Sheet>
  );
}

/** Whether the action being answered is aimed at this player, so a response is about defending themselves. */
function aimedAt(entry: StackEntry, playerId: string): boolean {
  switch (entry.kind) {
    case 'attack':
    case 'eliminate':
      return entry.targetId === playerId;
    case 'curse':
      return entry.affects.includes(playerId);
    case 'calamity':
      return entry.playerId === playerId;
    default:
      return false;
  }
}

/**
 * Reaction windows. Players who can respond get a prompt (blocking when the action is aimed at them,
 * a banner otherwise); everyone else sees who acted and how many players are still deciding, never who.
 * When the countdown ends, any client asks the server to close the window (the server checks its own clock).
 */
export function ReactionLayer({ G, turn, moves }: { G: PlayerViewState; turn: Turn; moves: Moves }) {
  const { me, send, busy } = turn;
  const window = G.window!;
  const entry = topEntry(G);
  const seconds = useCountdown(G);
  const [choosing, setChoosing] = useState<string | null>(null);

  useEffect(() => {
    if (seconds > 0) return;
    moves.closeWindow?.(window.id);
    const retry = setInterval(() => moves.closeWindow?.(window.id), 1500);
    return () => clearInterval(retry);
  }, [seconds, window.id]);
  useEffect(() => setChoosing(null), [window.id]);

  const canRespond = !!me && window.eligible.includes(me.id) && !window.passed.includes(me.id);
  // One button per kind of Curse, even when holding several copies.
  const usable = canRespond
    ? me!.curseHand.filter((c, i, hand) => canPlayInWindow(G, me!.id, c.curseId) && !curseNoEffectReason(G, me!.id, c.curseId) && hand.findIndex((x) => x.curseId === c.curseId) === i)
    : [];
  const card = usable.find((c) => c.id === choosing);
  const paused = !!window.heldBy;
  const timer = paused ? (window.heldBy === me?.id ? 'Paused while you choose' : 'Paused: a player is choosing a response') : `${seconds}s`;
  const fraction = paused ? 1 : Math.min(1, seconds / Math.max(1, G.config.reactions.windowSeconds));
  const what = entry ? describeEntry(G, entry, me?.id) : 'Waiting for reactions';
  const aimed = !!me && !!entry && aimedAt(entry, me.id);

  const play = (c: CurseCard) => {
    if (!needsTargets(c.curseId)) return send('playCurse', c.id, {});
    setChoosing(c.id);
    moves.holdWindow?.(window.id); // pause the countdown while choosing targets
  };
  const back = () => {
    setChoosing(null);
    if (window.heldBy === me?.id) send('releaseWindow', window.id);
  };
  const bar = (
    <div className="timer">
      <span className={`timer-track ${paused ? 'paused' : ''}`}><span style={{ width: `${fraction * 100}%` }} /></span>
      <span className="timer-text">{timer}</span>
    </div>
  );

  if (card && me) {
    return <CursePlaySheet key={card.id} G={G} me={me} card={card} onBack={back} onPlay={(target) => { send('playCurse', card.id, target); setChoosing(null); }} />;
  }

  if (canRespond && aimed) {
    return (
      <Sheet className="prompt" title={what} subtitle="Respond before the timer runs out">
        {bar}
        <div className="section-label"><span>Respond with a Curse</span></div>
        {usable.map((c) => (
          <button key={c.id} type="button" className="curse-response" disabled={busy} onClick={() => play(c)}>
            <CurseCardView G={G} curseId={c.curseId}>
              <span className="play-pill">Play</span>
            </CurseCardView>
          </button>
        ))}
        <button type="button" className="big outline" disabled={busy} onClick={() => send('pass', window.id)}>
          Let it happen
        </button>
      </Sheet>
    );
  }

  if (canRespond) {
    return (
      <div className="react-banner">
        <div className="react-head">
          <Icon name="curse" />
          <b className="grow">{what}. Respond?</b>
          <button type="button" className="small-btn" disabled={busy} onClick={() => send('pass', window.id)}>Not now</button>
        </div>
        {bar}
        <div className="react-chips">
          {usable.map((c) => (
            <button key={c.id} type="button" className="primary chip-btn" disabled={busy} title={curseEffect(G.config, curseOf(G, c.curseId))} onClick={() => play(c)}>
              {curseOf(G, c.curseId).name} <span className="stars">{'★'.repeat(curseOf(G, c.curseId).stars)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const myAttack = entry?.kind === 'attack' && entry.playerId === me?.id;
  return (
    <div className="react-banner waiting">
      <div className="react-head">
        <b className="grow">{what}</b>
      </div>
      {bar}
      <span className="small muted">
        {myAttack
          ? `Your attack lands unless it is canceled with a Curse. `
          : window.passed.includes(me?.id ?? '')
            ? 'You passed. '
            : ''}
        Waiting on {window.waitingCount} player{window.waitingCount === 1 ? '' : 's'} who may respond.
      </span>
    </div>
  );
}

/** Divine Foresight: reorder the top Expedition cards. */
export function ForesightSheet({ G, turn }: { G: PlayerViewState; turn: Turn }) {
  const [order, setOrder] = useState(() => G.foresight.map((c) => c.id));
  const move = (i: number, d: number) => {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    setOrder(next);
  };
  return (
    <Sheet title="Divine Foresight" subtitle={`Arrange the next ${order.length} Expedition cards. Only you can see them; the top is drawn first.`}>
      {order.map((id, i) => {
        const card = G.foresight.find((c) => c.id === id)!;
        return (
          <div key={id} className="row-card">
            {card.type === 'resource' ? (
              <span className={`mini-card bg-${card.resource}`}><Icon name={card.resource} size={14} /></span>
            ) : (
              <span className="mini-card calamity"><Icon name="alert" size={14} /></span>
            )}
            <span className="row-main">
              <b>{card.type === 'resource' ? RESOURCE_LABEL[card.resource] : 'Calamity'}</b>
              {card.type !== 'resource' && <CalamityText G={G} calamityId={card.calamityId} />}
            </span>
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button type="button" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
          </div>
        );
      })}
      <button type="button" className="big primary" disabled={turn.busy} onClick={() => turn.send('arrangeExpedition', order)}>
        Put them back in this order
      </button>
    </Sheet>
  );
}

function CalamityText({ G, calamityId }: { G: PlayerViewState; calamityId: string }) {
  const calamity = G.config.expedition.calamities.find((c) => c.id === calamityId);
  if (!calamity) return null;
  return (
    <>
      <span className="small">{calamity.name}</span>
      <span className="small muted">{calamityHelp(calamity)}</span>
    </>
  );
}

const burdenPer = (G: PlayerViewState) => {
  const n = G.config.curses.find((c) => c.id === 'structural-burden')?.params.discardPerStructure ?? 1;
  return n === 1 ? 'one card' : `${n} cards`;
};

const emptySelection = (): ResourceMap => ({ buildingMaterials: 0, warriors: 0, grain: 0, purpleDye: 0 });

/** A Calamity or Structural Burden: the affected player picks which inventory cards to discard. */
export function DiscardSheet({ G, turn, me }: { G: PlayerViewState; turn: Turn; me: Player }) {
  const [discard, setDiscard] = useState<ResourceMap>(emptySelection);
  const pending = G.pendingChoice;
  if (pending?.kind !== 'discardInventory') return null;
  const total = RESOURCES.reduce((n, r) => n + discard[r], 0);
  const step = (r: Resource, d: number) => setDiscard({ ...discard, [r]: Math.max(0, Math.min(me.inventory[r].length, discard[r] + d)) });
  const source =
    pending.source.type === 'calamity'
      ? `Calamity: ${G.config.expedition.calamities.find((c) => c.id === (pending.source as { calamityId: string }).calamityId)?.name}`
      : `Structural Burden: ${burdenPer(G)} per structure you own.`;
  return (
    <Sheet title={`Discard ${pending.count} cards`} subtitle={source}>
      <div className="steppers-grid">
        {RESOURCES.map((r) => (
          <div key={r} className={`tile bg-${r} stepper`}>
            <span className="small">{RESOURCE_LABEL[r]} ({me.inventory[r].length})</span>
            <div className="stepper-row">
              <button type="button" onClick={() => step(r, -1)} disabled={discard[r] === 0} aria-label={`Fewer ${RESOURCE_LABEL[r]}`}>−</button>
              <b>{discard[r]}</b>
              <button type="button" onClick={() => step(r, 1)} disabled={discard[r] >= me.inventory[r].length || total >= pending.count} aria-label={`More ${RESOURCE_LABEL[r]}`}>+</button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="big primary"
        disabled={turn.busy || total !== pending.count}
        onClick={() => {
          turn.send('chooseDiscard', discard);
          setDiscard(emptySelection());
        }}
      >
        Discard {total} / {pending.count}
      </button>
    </Sheet>
  );
}

/** Forced Conflict: Player A picks which of Player B's structures to attack. */
export function ForcedAttackSheet({ G, turn, targetId }: { G: PlayerViewState; turn: Turn; targetId: string }) {
  const victim = G.players.find((p) => p.id === targetId)!;
  return (
    <Sheet title="Forced Conflict" subtitle={`You must attack one of ${victim.name}'s structures.`}>
      <div className="structures">
        {victim.structures.map((s) => {
          const structure = G.config.structures.find((x) => x.id === s.structureId)!;
          return (
            <button key={s.id} type="button" className="structure" disabled={turn.busy} onClick={() => turn.send('forcedAttack', s.id)}>
              <span className={`chip round lg bg-${structure.category}`}><Icon name={structure.category} size={16} /></span>
              <span className="structure-text">
                <b>{structure.name}</b>
                <span className="muted small">{CATEGORY_LABEL[structure.category]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
