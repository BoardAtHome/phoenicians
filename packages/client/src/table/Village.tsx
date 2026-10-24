import { RESOURCES, inventoryCounts, inventorySize, type Player } from '@phoenicians/engine';
import { HIDDEN, type PlayerViewState } from '@phoenicians/game';
import { CATEGORY_LABEL, RESOURCE_LABEL } from '../format';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Big resource tiles, as in your dock. */
export function ResourceTiles({ player, compact }: { player: Player; compact?: boolean }) {
  const counts = inventoryCounts(player.inventory);
  return (
    <div className={`tiles ${compact ? 'compact' : ''}`}>
      {RESOURCES.map((r) => (
        <div key={r} className={`tile bg-${r}`}>
          <Icon name={r} size={compact ? 14 : 16} />
          <b>{counts[r]}</b>
          {!compact && <span>{RESOURCE_LABEL[r]}</span>}
        </div>
      ))}
    </div>
  );
}

/** A player's inventory and structures. */
export function VillageSheet({ G, player, isMe, onClose }: { G: PlayerViewState; player: Player; isMe: boolean; onClose: () => void }) {
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
      <ResourceTiles player={player} compact />
      <div className="section-label">
        <span>Structures</span>
        <span className="muted">Visible to everyone</span>
      </div>
      {player.structures.length === 0 ? (
        <p className="muted small">No structures yet.</p>
      ) : (
        <div className="structures">
          {player.structures.map((card) => {
            const s = G.config.structures.find((x) => x.id === card.structureId)!;
            return (
              <div key={card.id} className="structure">
                <span className={`chip round lg bg-${s.category}`}><Icon name={s.category} size={16} /></span>
                <span>
                  <b>{s.name}</b>
                  <span className="muted small">{CATEGORY_LABEL[s.category]}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
