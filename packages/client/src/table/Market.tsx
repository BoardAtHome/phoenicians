import { RESOURCES, canAfford, inventoryCounts, type Player, type ResourceMap } from '@phoenicians/engine';
import type { PlayerViewState } from '@phoenicians/game';
import { CATEGORY_LABEL, RESOURCE_LABEL } from '../format';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import type { Turn } from './useTurn';

/** Cost chips in resource colors; a ring marks each resource you are short of. */
export function CostChips({ cost, player }: { cost: ResourceMap; player?: Player }) {
  const have = player ? inventoryCounts(player.inventory) : undefined;
  return (
    <span className="cost-chips">
      {RESOURCES.filter((r) => cost[r] > 0).map((r) => (
        <span key={r} className={`cost bg-${r} ${have && have[r] < cost[r] ? 'short' : ''}`} title={`${cost[r]} ${RESOURCE_LABEL[r]}`}>
          <Icon name={r} size={12} />
          {cost[r]}
        </span>
      ))}
    </span>
  );
}

/** "Need 3 Materials, 1 Grain", or '' when affordable. */
export function shortfall(cost: ResourceMap, player: Player): string {
  const have = inventoryCounts(player.inventory);
  const parts = RESOURCES.filter((r) => have[r] < cost[r]).map((r) => `${cost[r] - have[r]} ${RESOURCE_LABEL[r]}`);
  return parts.length ? `Need ${parts.join(', ')}` : '';
}

/** The face-up buildings, with what you're missing for each. */
export function MarketSheet({ G, turn, onClose }: { G: PlayerViewState; turn: Turn; onClose: () => void }) {
  const { me, canAct, send } = turn;
  return (
    <Sheet title="Market" subtitle={`${G.shop.filter(Boolean).length} face-up · refills from the building deck (${G.counts.buildingDeck} left)`} onClose={onClose}>
      {me?.constructionBanned && <p className="hint">A Construction Ban stops you building this turn.</p>}
      {G.shop.map((card, slot) => {
        if (!card) return <div key={slot} className="row-card muted">Empty slot</div>;
        const s = G.config.structures.find((x) => x.id === card.structureId)!;
        const affordable = !!me && canAfford(me.inventory, s.cost);
        const need = me && !affordable ? shortfall(s.cost, me) : '';
        return (
          <div key={card.id} className="row-card">
            <span className={`chip lg bg-${s.category}`}><Icon name={s.category} size={20} /></span>
            <div className="row-main">
              <div>
                <b>{s.name}</b> <span className="muted small">{CATEGORY_LABEL[s.category]}</span>
              </div>
              <CostChips cost={s.cost} player={me} />
              {need && <span className="need">{need}</span>}
            </div>
            <button
              type="button"
              className="primary"
              disabled={!canAct || !affordable || !!me?.constructionBanned}
              onClick={() => {
                send('build', slot);
                onClose();
              }}
            >
              Build
            </button>
          </div>
        );
      })}
      {!canAct && <p className="muted small">You can build during your actions.</p>}
    </Sheet>
  );
}
