import { useState } from 'react';
import {
  CURSE_TARGETS,
  RESOURCES,
  REACTIVE_CURSES,
  burdenCount,
  sabotageCount,
  type CurseCard,
  type CurseTarget,
  type Player,
  type Resource,
} from '@phoenicians/engine';
import type { PlayerViewState } from '@phoenicians/game';
import { RESOURCE_LABEL } from '../format';

type Send = (move: string, ...args: unknown[]) => void;

/** Your hand of Curses, with a form for the one you're about to play. */
export function CurseHand({ G, me, canAct, send }: { G: PlayerViewState; me: Player; canAct: boolean; send: Send }) {
  const [selected, setSelected] = useState<string | null>(null);
  const card = me.curseHand.find((c) => c.id === selected);

  return (
    <>
      <h4>Your Curses ({me.curseHand.length})</h4>
      <div className="curses">
        {me.curseHand.map((c) => {
          const curse = G.config.curses.find((x) => x.id === c.curseId);
          if (!curse) return null;
          const reactive = REACTIVE_CURSES.has(c.curseId);
          return (
            <div key={c.id} className={`curse ${selected === c.id ? 'selected' : ''}`}>
              <div className="card-title">{curse.name} <span className="stars">{'★'.repeat(curse.stars)}</span></div>
              <div className="small">{curse.text}</div>
              {reactive ? (
                <span className="muted small">You'll be offered this when it applies.</span>
              ) : (
                <button disabled={!canAct} onClick={() => setSelected(selected === c.id ? null : c.id)}>
                  {selected === c.id ? 'Cancel' : 'Play'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {card && canAct && (
        <CurseForm key={card.id} G={G} me={me} card={card} onPlay={(target) => { send('playCurse', card.id, target); setSelected(null); }} />
      )}
    </>
  );
}

export function CurseForm({ G, me, card, onPlay }: { G: PlayerViewState; me: Player; card: CurseCard; onPlay: (t: CurseTarget) => void }) {
  const fields = CURSE_TARGETS[card.curseId] ?? [];
  const curse = G.config.curses.find((c) => c.id === card.curseId)!;
  const [target, setTarget] = useState<CurseTarget>({});
  const set = (patch: Partial<CurseTarget>) => setTarget({ ...target, ...patch });

  const live = G.players.filter((p) => !p.eliminated);
  const choices = fields.includes('opponent') ? live.filter((p) => p.id !== me.id) : live;
  const chosen = G.players.find((p) => p.id === target.playerId);
  const discardHas = (r: Resource) => G.expeditionDiscard.some((c) => c.type === 'resource' && c.resource === r);
  const sabotage = chosen ? sabotageCount(G, chosen) : 0;

  let ready = true;
  if ((fields.includes('opponent') || fields.includes('player')) && !target.playerId) ready = false;
  if (fields.includes('secondPlayer') && !target.secondPlayerId) ready = false;
  if (fields.includes('resource') && !target.resource) ready = false;
  if (fields.includes('exchange') && (!target.give || !target.take)) ready = false;
  if (fields.includes('structures') && (target.structureCardIds?.length ?? 0) !== sabotage) ready = false;

  const nameOf = (p: Player) => (p.id === me.id ? `${p.name} (you)` : p.name);

  return (
    <div className="panel curse-form">
      <strong>Play {curse.name}</strong>
      {(fields.includes('opponent') || fields.includes('player')) && (
        <label className="row">
          {fields.includes('secondPlayer') ? 'Player A (attacks)' : 'Target'}
          <select value={target.playerId ?? ''} onChange={(e) => set({ playerId: e.target.value || undefined, structureCardIds: [] })}>
            <option value="">Choose…</option>
            {choices.map((p) => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
          </select>
        </label>
      )}
      {fields.includes('secondPlayer') && (
        <label className="row">
          Player B (is attacked)
          <select value={target.secondPlayerId ?? ''} onChange={(e) => set({ secondPlayerId: e.target.value || undefined })}>
            <option value="">Choose…</option>
            {live.filter((p) => p.id !== target.playerId).map((p) => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
          </select>
        </label>
      )}
      {fields.includes('resource') && (
        <label className="row">
          Resource
          <select value={target.resource ?? ''} onChange={(e) => set({ resource: (e.target.value || undefined) as Resource })}>
            <option value="">Choose…</option>
            {RESOURCES.map((r) => <option key={r} value={r}>{RESOURCE_LABEL[r]}</option>)}
          </select>
        </label>
      )}
      {fields.includes('exchange') && (
        <div className="row">
          Give
          <select value={target.give ?? ''} onChange={(e) => set({ give: (e.target.value || undefined) as Resource })}>
            <option value="">Choose…</option>
            {RESOURCES.filter((r) => me.inventory[r].length > 0).map((r) => <option key={r} value={r}>{RESOURCE_LABEL[r]}</option>)}
          </select>
          take from the discard pile
          <select value={target.take ?? ''} onChange={(e) => set({ take: (e.target.value || undefined) as Resource })}>
            <option value="">Choose…</option>
            {RESOURCES.filter(discardHas).map((r) => <option key={r} value={r}>{RESOURCE_LABEL[r]}</option>)}
          </select>
        </div>
      )}
      {fields.includes('structures') && chosen && (
        <div className="stack">
          <span className="small">
            {chosen.name} has {chosen.inventory.warriors.length} Warriors, so you destroy {sabotage} structure{sabotage === 1 ? '' : 's'}.
            {sabotage > 0 && ' Pick which:'}
          </span>
          <div className="village">
            {chosen.structures.map((s) => {
              const on = target.structureCardIds?.includes(s.id) ?? false;
              const name = G.config.structures.find((x) => x.id === s.structureId)?.name;
              return (
                <label key={s.id} className="radio">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && (target.structureCardIds?.length ?? 0) >= sabotage}
                    onChange={() => set({ structureCardIds: on ? target.structureCardIds!.filter((x) => x !== s.id) : [...(target.structureCardIds ?? []), s.id] })}
                  />
                  {name}
                </label>
              );
            })}
          </div>
        </div>
      )}
      {card.curseId === 'structural-burden' && chosen && (
        <span className="small muted">{chosen.name} will discard {burdenCount(G, chosen)} card(s) of their choice.</span>
      )}
      <button className="primary" disabled={!ready} onClick={() => onPlay(target)}>Play Curse</button>
    </div>
  );
}

/** Divine Foresight: reorder the top Expedition cards. */
export function ForesightDialog({ G, send, busy }: { G: PlayerViewState; send: Send; busy: boolean }) {
  const [order, setOrder] = useState(() => G.foresight.map((c) => c.id));
  const move = (i: number, d: number) => {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    setOrder(next);
  };
  return (
    <div className="panel dialog">
      <h3>Divine Foresight: arrange the next {order.length} Expedition cards</h3>
      <p className="muted small">Only you can see these. The top of the list is drawn first.</p>
      <ol className="foresight">
        {order.map((id, i) => {
          const card = G.foresight.find((c) => c.id === id)!;
          const label = card.type === 'resource' ? RESOURCE_LABEL[card.resource] : `Calamity: ${G.config.expedition.calamities.find((c) => c.id === card.calamityId)?.name}`;
          return (
            <li key={id}>
              <span className={card.type === 'resource' ? `res res-${card.resource}` : 'res calamity'}>{label}</span>
              <button disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button disabled={i === order.length - 1} onClick={() => move(i, 1)}>↓</button>
            </li>
          );
        })}
      </ol>
      <button className="primary" disabled={busy} onClick={() => send('arrangeExpedition', order)}>Put them back in this order</button>
    </div>
  );
}

/** Forced Conflict: Player A picks which of Player B's structures to attack. */
export function ForcedAttackDialog({ G, targetId, send, busy }: { G: PlayerViewState; targetId: string; send: Send; busy: boolean }) {
  const victim = G.players.find((p) => p.id === targetId)!;
  return (
    <div className="panel dialog">
      <h3>Forced Conflict: you must attack one of {victim.name}'s structures</h3>
      <div className="village">
        {victim.structures.map((s) => (
          <button key={s.id} className="danger" disabled={busy} onClick={() => send('forcedAttack', s.id)}>
            {G.config.structures.find((x) => x.id === s.structureId)?.name}
          </button>
        ))}
      </div>
    </div>
  );
}
