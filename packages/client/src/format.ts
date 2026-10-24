import { RESOURCES, type GameEvent, type GameState, type Resource, type ResourceMap } from '@phoenicians/engine';

export const RESOURCE_LABEL: Record<Resource, string> = {
  buildingMaterials: 'Materials',
  warriors: 'Warriors',
  grain: 'Grain',
  purpleDye: 'Purple Dye',
};

export const CATEGORY_LABEL = { civic: 'Civic', military: 'Military', agricultural: 'Agricultural', commercial: 'Commercial' } as const;

export const costText = (cost: ResourceMap) =>
  RESOURCES.filter((r) => cost[r] > 0)
    .map((r) => `${cost[r]} ${RESOURCE_LABEL[r]}`)
    .join(' + ') || 'Free';

const name = (G: GameState, id: unknown) => G.players.find((p) => p.id === id)?.name ?? String(id);
const structureName = (G: GameState, id: unknown) => G.config.structures.find((s) => s.id === id)?.name ?? String(id);
const calamityName = (G: GameState, id: unknown) => G.config.expedition.calamities.find((c) => c.id === id)?.name ?? String(id);
const prophecyName = (G: GameState, id: unknown) => G.config.prophecies.find((p) => p.id === id)?.name ?? String(id);

/** Turns a log event into a sentence for the activity feed. */
export function describeEvent(G: GameState, e: GameEvent): string | null {
  const who = e.playerId ? name(G, e.playerId) : '';
  const d = e.data ?? {};
  switch (e.type) {
    case 'gameStarted':
      return 'The game began.';
    case 'turnStarted':
      return `${who}'s turn.`;
    case 'structureBuilt':
      return `${who} built ${structureName(G, d.structureId)}.`;
    case 'expeditionStarted':
      return `${who} set out on ${d.extra ? 'an extra' : 'an'} expedition.`;
    case 'expeditionDraw':
      return `${who} drew ${RESOURCE_LABEL[d.resource as Resource]}.`;
    case 'calamityIgnored':
      return `${who} drew "${calamityName(G, d.calamityId)}" as their first card. It was ignored.`;
    case 'calamityApplied':
      return `Calamity for ${who}: ${calamityName(G, d.calamityId)}.`;
    case 'discardChosen':
      return `${who} chose cards to discard.`;
    case 'cursePlayed': {
      const curse = G.config.curses.find((c) => c.id === d.curseId)?.name ?? String(d.curseId);
      const on = d.targetId ? ` on ${name(G, d.targetId)}` : '';
      const and = d.secondPlayerId ? `, against ${name(G, d.secondPlayerId)}` : '';
      const res = d.resource ? ` (${RESOURCE_LABEL[d.resource as Resource]})` : '';
      return `${who} played ${curse}${on}${and}${res}.`;
    }
    case 'expeditionArranged':
      return `${who} rearranged the top of the Expedition deck.`;
    case 'expeditionEnded':
      return `${who} returned with ${d.kept} card${d.kept === 1 ? '' : 's'}.`;
    case 'expeditionDeckReshuffled':
      return 'The Expedition discard pile was reshuffled into a new deck.';
    case 'attacked':
      return `${who} ${d.forced ? 'was forced to attack' : 'attacked'} ${name(G, d.targetId)}.`;
    case 'structureDestroyed':
      return `${who}'s ${structureName(G, d.structureId)} was destroyed.`;
    case 'ritualPerformed':
      return `${who} performed a ritual and drew a Curse.`;
    case 'curseDeckReshuffled':
      return 'The Curse discard pile was reshuffled.';
    case 'divineCoinBought':
      return `${who} bought a Divine Coin.`;
    case 'prophecyGuessed':
      return `${who} guessed ${name(G, d.targetId)} is ${prophecyName(G, d.prophecyId)}: ${d.correct ? 'correct!' : 'wrong.'}`;
    case 'playerEliminated':
      return `${who} was eliminated. Their Prophecy was ${prophecyName(G, d.prophecyId)}.`;
    case 'prophecyReplaced':
      return `${who}'s Prophecy was replaced.`;
    case 'gameWon':
      return d.reason === 'prophecy'
        ? `${who} revealed ${prophecyName(G, d.prophecyId)} and won the game!`
        : `${who} is the last player standing and wins!`;
    default:
      return null;
  }
}
