import { useState } from 'react';
import { RESOURCES, canAfford, inventoryCounts, inventorySize, type GameConfig, type Player } from '@phoenicians/engine';
import { HIDDEN, type PlayerViewState } from '@phoenicians/game';
import { CATEGORY_LABEL, RESOURCE_LABEL, costText } from '../format';
import { resourceHelp, structureHelp } from '../help';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import type { Turn } from './useTurn';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Big resource tiles, as in your dock. */
export function ResourceTiles({ player, compact, config }: { player: Player; compact?: boolean; config?: GameConfig }) {
  const counts = inventoryCounts(player.inventory);
  return (
    <div className={`tiles ${compact ? 'compact' : ''}`}>
      {RESOURCES.map((r) => (
        <div key={r} className={`tile bg-${r}`} title={config ? `${RESOURCE_LABEL[r]}: ${resourceHelp(config, r)}` : RESOURCE_LABEL[r]}>
          <Icon name={r} size={compact ? 14 : 16} />
          <b>{counts[r]}</b>
          {!compact && <span>{RESOURCE_LABEL[r]}</span>}
        </div>
      ))}
    </div>
  );
}

/** A player's inventory and structures. A rival's structures can be picked as attack targets. */
export function VillageSheet({ G, player, turn, onClose }: { G: PlayerViewState; player: Player; turn: Turn; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const isMe = player.id === turn.me?.id;
  const attackable = !isMe && !!turn.me && !player.eliminated && player.structures.length > 0;
  const cost = G.config.costs.attack;
  const affordable = !!turn.me && canAfford(turn.me.inventory, cost);
  const pickedName = player.structures.find((c) => c.id === picked);
  const subtitle = isMe
    ? `${plural(player.structures.length, 'structure')} · ${plural(player.curseHand.length, 'Curse')} · ${plural(player.divineCoins, 'Divine Coin')}`
    : `${plural(inventorySize(player.inventory), 'card')} · ${plural(player.curseHand.length, 'Curse')} · ${plural(player.divineCoins, 'Divine Coin')}`;
  const revealed = player.eliminated && player.prophecyId !== HIDDEN ? G.config.prophecies.find((p) => p.id === player.prophecyId) : undefined;
  return (
    <Sheet title={isMe ? 'Your village' : `${player.name}'s village`} subtitle={subtitle} onClose={onClose}>
      {player.eliminated && (
        <p className="hint">
          {player.reviving ? 'Eliminated, returns next turn with Revival.' : 'Eliminated.'}
          {revealed && ` Their Prophecy was ${revealed.name}.`}
        </p>
      )}
      <ResourceTiles player={player} compact config={G.config} />
      <div className="section-label">
        <span>Structures</span>
        <span className="muted">{attackable ? 'Tap one to target it' : 'Visible to everyone'}</span>
      </div>
      {player.structures.length === 0 ? (
        <p className="muted small">No structures yet.</p>
      ) : (
        <div className="structures">
          {player.structures.map((card) => {
            const s = G.config.structures.find((x) => x.id === card.structureId)!;
            const body = (

              <>
                <span className={`chip round lg bg-${s.category}`}><Icon name={s.category} size={16} /></span>
                <span className="structure-text">
                  <b>{s.name}</b>
                  <span className="muted small">{CATEGORY_LABEL[s.category]}</span>
                </span>
                {picked === card.id && <span className="picked"><Icon name="check" size={14} /></span>}
              </>
            );
            return attackable ? (
              <button key={card.id} type="button" title={structureHelp(G.config, s)} className={`structure ${picked === card.id ? 'selected' : ''}`} onClick={() => setPicked(picked === card.id ? null : card.id)} aria-pressed={picked === card.id}>
                {body}
              </button>
            ) : (
              <div key={card.id} className="structure" title={structureHelp(G.config, s)}>{body}</div>
            );
          })}
        </div>
      )}
      {attackable && (
        <button
          type="button"
          className="big danger-btn"
          disabled={!turn.canAct || !affordable || !pickedName}
          onClick={() => {
            turn.send('attack', player.id, picked);
            onClose();
          }}
        >
          <Icon name="attack" />
          {!turn.canAct
            ? 'Attack during your actions'
            : !affordable
              ? `Need ${costText(cost)} to attack`
              : pickedName
                ? `Attack ${G.config.structures.find((x) => x.id === pickedName.structureId)?.name} · ${costText(cost)}`
                : 'Select a structure'}
        </button>
      )}
    </Sheet>
  );
}
