import { useState } from 'react';
import { canAfford, type ResourceMap } from '@phoenicians/engine';
import type { PlayerViewState } from '@phoenicians/game';
import { metricText } from '../format';
import { Icon, type IconName } from './Icon';
import { CostChips, shortfall } from './Market';
import { Avatar } from './Seat';
import { Sheet } from './Sheet';
import type { Turn } from './useTurn';

/** Ritual, Divine Coin, Attack and Guess a Prophecy, with costs from the config. */
export function ActionsSheet({
  G,
  turn,
  onClose,
  onAttack,
  onGuess,
}: {
  G: PlayerViewState;
  turn: Turn;
  onClose: () => void;
  onAttack: () => void;
  onGuess: () => void;
}) {
  const { me, canAct, send } = turn;
  if (!me) return null;
  const costs = G.config.costs;
  const rows: { icon: IconName; title: string; text: string; cost: ResourceMap | null; coins?: number; ok: boolean; why: string; go: () => void }[] = [
    {
      icon: 'ritual',
      title: 'Ritual',
      text: 'Draw a Curse from the Curse deck.',
      cost: costs.ritual,
      ok: canAfford(me.inventory, costs.ritual),
      why: shortfall(costs.ritual, me),
      go: () => { send('ritual'); onClose(); },
    },
    {
      icon: 'coin',
      title: 'Divine Coin',
      text: "Buy a coin to guess a rival's Prophecy.",
      cost: costs.divineCoin,
      ok: canAfford(me.inventory, costs.divineCoin),
      why: shortfall(costs.divineCoin, me),
      go: () => { send('buyDivineCoin'); onClose(); },
    },
    {
      icon: 'attack',
      title: 'Attack',
      text: "Pick a rival's structure to destroy it.",
      cost: costs.attack,
      ok: canAfford(me.inventory, costs.attack),
      why: shortfall(costs.attack, me),
      go: onAttack,
    },
    {
      icon: 'eye',
      title: 'Guess a Prophecy',
      text: 'A right guess eliminates that player.',
      cost: null,
      coins: costs.guessProphecy,
      ok: me.divineCoins >= costs.guessProphecy,
      why: `Need ${costs.guessProphecy} Divine Coin${costs.guessProphecy === 1 ? '' : 's'}`,
      go: onGuess,
    },
  ];
  return (
    <Sheet title="Actions" subtitle="As many as you can afford this turn" onClose={onClose}>
      {rows.map((row) => {
        const enabled = canAct && row.ok;
        return (
          <button key={row.title} type="button" className="row-card action" disabled={!enabled} onClick={row.go}>
            <span className="chip lg action-icon"><Icon name={row.icon} size={20} /></span>
            <span className="row-main">
              <b>{row.title}</b>
              <span className="small muted">{row.text}</span>
              {!row.ok && <span className="need">{row.why}</span>}
            </span>
            {row.cost ? (
              <CostChips cost={row.cost} player={me} />
            ) : (
              <span className={`cost coin-cost ${row.ok ? '' : 'short'}`}><Icon name="coin" size={12} />{row.coins}</span>
            )}
          </button>
        );
      })}
      {!canAct && <p className="muted small">Actions are available during your turn, before you set out.</p>}
    </Sheet>
  );
}

/** Pick a rival and a Prophecy type. Only types are listed: nobody's card is ever sent to the client. */
export function GuessSheet({ G, turn, onClose }: { G: PlayerViewState; turn: Turn; onClose: () => void }) {
  const { me, canAct, send } = turn;
  const [target, setTarget] = useState('');
  const [prophecy, setProphecy] = useState('');
  if (!me) return null;
  const cost = G.config.costs.guessProphecy;
  const rivals = G.players.filter((p) => p.id !== me.id && !p.eliminated);
  return (
    <Sheet title="Guess a Prophecy" subtitle={`You have ${me.divineCoins} Divine Coin${me.divineCoins === 1 ? '' : 's'}`} onClose={onClose}>
      <div className="section-label"><span>Whose Prophecy?</span></div>
      <div className="pick-grid players">
        {rivals.map((p) => (
          <button key={p.id} type="button" className={`pick ${target === p.id ? 'selected' : ''}`} onClick={() => setTarget(p.id)} aria-pressed={target === p.id}>
            <Avatar G={G} player={p} size={30} />
            <span className="small">{p.name}</span>
          </button>
        ))}
      </div>
      <div className="section-label"><span>Which Prophecy?</span></div>
      <div className="pick-grid">
        {G.config.prophecies.map((p) => (
          <button key={p.id} type="button" className={`pick left ${prophecy === p.id ? 'selected' : ''}`} onClick={() => setProphecy(p.id)} aria-pressed={prophecy === p.id}>
            <b>{p.name}</b>
            <span className="small">{p.threshold} {metricText(p)}</span>
          </button>
        ))}
      </div>
      <p className="muted small">A right guess eliminates them. A wrong guess only costs the coin.</p>
      <button
        type="button"
        className="big primary"
        disabled={!canAct || !target || !prophecy || me.divineCoins < cost}
        onClick={() => {
          send('guessProphecy', target, prophecy);
          onClose();
        }}
      >
        <Icon name="coin" /> Guess · {cost} Divine Coin{cost === 1 ? '' : 's'}
      </button>
    </Sheet>
  );
}
