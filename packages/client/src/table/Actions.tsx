import { useState } from 'react';
import { canAfford, type ResourceMap } from '@phoenicians/engine';
import type { PlayerViewState } from '@phoenicians/game';
import { attackHelp, divineCoinHelp, evaluationHelp, evaluationLabel, guessHelp, prophecyGoal, prophecyHow, ritualHelp } from '../help';
import { Icon, type IconName } from './Icon';
import { CostChips, shortfall } from './Market';
import { Avatar } from './Seat';
import { HelpLink, Sheet } from './Sheet';
import type { Turn } from './useTurn';

/** Ritual, Divine Coin, Attack and Guess a Prophecy, with costs from the config. */
export function ActionsSheet({
  G,
  turn,
  onClose,
  onAttack,
  onGuess,
  onHelp,
}: {
  G: PlayerViewState;
  turn: Turn;
  onClose: () => void;
  onAttack: () => void;
  onGuess: () => void;
  onHelp: () => void;
}) {
  const { me, canAct, send } = turn;
  if (!me) return null;
  const costs = G.config.costs;
  const rows: { icon: IconName; title: string; text: string; cost: ResourceMap | null; coins?: number; ok: boolean; why: string; go: () => void }[] = [
    {
      icon: 'ritual',
      title: 'Ritual',
      text: ritualHelp(),
      cost: costs.ritual,
      ok: canAfford(me.inventory, costs.ritual),
      why: shortfall(costs.ritual, me),
      go: () => { send('ritual'); onClose(); },
    },
    {
      icon: 'coin',
      title: 'Divine Coin',
      text: divineCoinHelp(G.config),
      cost: costs.divineCoin,
      ok: canAfford(me.inventory, costs.divineCoin),
      why: shortfall(costs.divineCoin, me),
      go: () => { send('buyDivineCoin'); onClose(); },
    },
    {
      icon: 'attack',
      title: 'Attack',
      text: attackHelp(),
      cost: costs.attack,
      ok: canAfford(me.inventory, costs.attack),
      why: shortfall(costs.attack, me),
      go: onAttack,
    },
    {
      icon: 'eye',
      title: 'Guess a Prophecy',
      text: guessHelp(),
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
      <p className="muted small">Building is in the Market. When you are done, Set out on an expedition to collect resources.</p>
      <HelpLink onOpen={onHelp} label="How a turn works" />
    </Sheet>
  );
}

/** Pick a rival and a Prophecy type. Only types are listed: nobody's card is ever sent to the client. */
export function GuessSheet({ G, turn, onClose, onHelp }: { G: PlayerViewState; turn: Turn; onClose: () => void; onHelp: () => void }) {
  const { me, canAct, send } = turn;
  const [target, setTarget] = useState('');
  const [prophecy, setProphecy] = useState('');
  if (!me) return null;
  const cost = G.config.costs.guessProphecy;
  const rivals = G.players.filter((p) => p.id !== me.id && !p.eliminated);
  const chosen = G.config.prophecies.find((p) => p.id === prophecy);
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
            <span className="small">{prophecyGoal(p)} · {evaluationLabel(p)}</span>
          </button>
        ))}
      </div>
      {chosen && <p className="small muted"><b>{chosen.name}:</b> {prophecyHow(G.config, chosen)} {evaluationHelp(chosen)}</p>}
      <p className="muted small">A right guess eliminates them. A wrong guess only costs the coin.</p>
      <HelpLink onOpen={onHelp} label="What each Prophecy means" />
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
