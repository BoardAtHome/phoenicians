import { RESOURCES, inventoryCounts, type Player } from '@phoenicians/engine';
import type { PlayerViewState } from '@phoenicians/game';
import { CATEGORY_LABEL, RESOURCE_LABEL } from '../format';
import { Icon } from './Icon';
import { seatColor } from './useTurn';

export const CATEGORIES = ['civic', 'military', 'agricultural', 'commercial'] as const;

export function categoryCounts(G: PlayerViewState, player: Player) {
  const counts = { civic: 0, military: 0, agricultural: 0, commercial: 0 };
  for (const card of player.structures) {
    const s = G.config.structures.find((x) => x.id === card.structureId);
    if (s) counts[s.category]++;
  }
  return counts;
}

export function Avatar({ G, player, size = 26 }: { G: PlayerViewState; player: Player; size?: number }) {
  return (
    <span className="avatar" style={{ background: seatColor(G, player.id), width: size, height: size, fontSize: size * 0.48 }}>
      {player.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/** Four resource squares with counts. */
export function ResourceCounts({ player }: { player: Player }) {
  const counts = inventoryCounts(player.inventory);
  return (
    <div className="counts">
      {RESOURCES.map((r) => (
        <span key={r} className="count" title={`${RESOURCE_LABEL[r]}: ${counts[r]}`}>
          <span className={`chip sq bg-${r}`}><Icon name={r} size={12} /></span>
          {counts[r]}
        </span>
      ))}
    </div>
  );
}

/** Four category circles with how many structures of each kind. */
export function CategoryCounts({ G, player }: { G: PlayerViewState; player: Player }) {
  const counts = categoryCounts(G, player);
  return (
    <div className="counts">
      {CATEGORIES.map((c) => (
        <span key={c} className={`count ${counts[c] === 0 ? 'zero' : ''}`} title={`${CATEGORY_LABEL[c]}: ${counts[c]}`}>
          <span className={`chip round bg-${c}`}><Icon name={c} size={12} /></span>
          {counts[c]}
        </span>
      ))}
    </div>
  );
}

/** A rival at the table. Everything shown here is public. */
export function Seat({
  G,
  player,
  variant,
  connected,
  targeting,
  onClick,
}: {
  G: PlayerViewState;
  player: Player;
  variant: 'wide' | 'narrow';
  connected: boolean;
  targeting?: boolean;
  onClick?: () => void;
}) {
  const current = player.id === G.turn.activePlayerId && G.turn.phase !== 'gameOver';
  const out = player.eliminated;
  const classes = ['seat-card', variant, current && 'current', targeting && 'targeting', out && 'out'].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} onClick={onClick} disabled={!onClick} aria-label={`${player.name}'s village`}>
      <div className="seat-head">
        <Avatar G={G} player={player} size={variant === 'narrow' ? 30 : 24} />
        <span className="seat-name">
          <span className={`dot ${connected ? 'on' : ''}`} /> {player.name}
        </span>
        <span className="seat-meta">
          <span title="Curses in hand"><Icon name="curse" size={12} />{player.curseHand.length}</span>
          <span title="Divine Coins"><Icon name="coin" size={12} />{player.divineCoins}</span>
        </span>
      </div>
      {out && <div className="seat-out">{player.reviving ? 'Returns next turn' : 'Out'}</div>}
      <ResourceCounts player={player} />
      <CategoryCounts G={G} player={player} />
    </button>
  );
}
