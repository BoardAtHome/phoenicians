import { RESOURCES, type GameEvent, type GameState, type Resource, type ResourceMap, type StackEntry } from '@phoenicians/engine';

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

const curseName = (G: GameState, id: unknown) => G.config.curses.find((c) => c.id === id)?.name ?? String(id);

/** What a reaction window is about, e.g. "Ana attacked Bob's Farm". */
export function describeEntry(G: GameState, e: StackEntry): string {
  const who = name(G, e.playerId);
  switch (e.kind) {
    case 'attack': {
      const target = G.players.find((p) => p.id === e.targetId);
      const card = target?.structures.find((s) => s.id === e.structureCardId);
      return `${who} is attacking ${name(G, e.targetId)}'s ${card ? structureName(G, card.structureId) : 'structure'}`;
    }
    case 'ritual':
      return `${who} is performing a ritual to draw a Curse`;
    case 'calamity':
      return `${who} drew a Calamity: ${calamityName(G, e.calamityId)}`;
    case 'eliminate':
      return `${who} guessed ${name(G, e.targetId)}'s Prophecy. ${name(G, e.targetId)} is about to be eliminated`;
    case 'curse': {
      const on = e.target.playerId ? ` on ${name(G, e.target.playerId)}` : '';
      return `${who} played ${curseName(G, e.curseId)}${on}`;
    }
    case 'moment': {
      if (e.action === 'draw') {
        const last = G.expedition?.drawn[G.expedition.drawn.length - 1];
        return last && G.expedition?.lastDrawWasResource ? `${who} drew ${RESOURCE_LABEL[last.resource]}` : `${who} drew a card`;
      }
      if (e.action === 'build') return `${who} built a structure`;
      if (e.action === 'buyDivineCoin') return `${who} bought a Divine Coin`;
      return `${who} guessed a Prophecy`;
    }
  }
}

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
      return d.outOfTurn ? `${who} set out on an extra expedition outside their turn.` : `${who} set out on ${d.extra ? 'an extra' : 'an'} expedition.`;
    case 'expeditionDraw':
      return `${who} drew ${RESOURCE_LABEL[d.resource as Resource]}.`;
    case 'calamityIgnored':
      return `${who} drew "${calamityName(G, d.calamityId)}" as their first card. It was ignored.`;
    case 'calamityDrawn':
      return `${who} drew a Calamity: ${calamityName(G, d.calamityId)}.`;
    case 'calamityPrevented':
      return `${who} was protected from ${calamityName(G, d.calamityId)}.`;
    case 'calamityFizzled':
      return `${calamityName(G, d.calamityId)} had no effect: the expedition was already over.`;
    case 'calamityApplied':
      return `Calamity for ${who}: ${calamityName(G, d.calamityId)}.`;
    case 'discardChosen':
      return `${who} chose cards to discard.`;
    case 'cursePlayed': {
      const curse = G.config.curses.find((c) => c.id === d.curseId)?.name ?? String(d.curseId);
      const on = d.targetId ? ` on ${name(G, d.targetId)}` : '';
      const and = d.secondPlayerId ? `, against ${name(G, d.secondPlayerId)}` : '';
      const res = d.resource ? ` (${RESOURCE_LABEL[d.resource as Resource]})` : '';
      return `${who} ${d.answering ? 'answered with' : 'played'} ${curse}${on}${and}${res}.`;
    }
    case 'curseCanceled':
      return `${who}'s ${curseName(G, d.curseId)} was canceled.`;
    case 'curseFizzled':
      return `${who}'s ${curseName(G, d.curseId)} had no effect (${d.reason}).`;
    case 'curseIntercepted':
      return `${who} intercepted the Curse from ${name(G, d.from)}'s ritual.`;
    case 'expeditionStolen':
      return `${who} stole ${d.count} card${d.count === 1 ? '' : 's'} from ${name(G, d.from)}'s expedition.`;
    case 'attackCanceled':
      return `${who}'s attack on ${name(G, d.targetId)} was canceled.`;
    case 'attackFizzled':
      return `${who}'s attack on ${name(G, d.targetId)} found nothing to destroy.`;
    case 'ritualEmpty':
      return `${who}'s ritual found no Curses left to draw.`;
    case 'playerRevived':
      return `${who} returned to the game with Revival.`;
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
      return `${who} performed a ritual.`;
    case 'curseDeckReshuffled':
      return 'The Curse discard pile was reshuffled.';
    case 'divineCoinBought':
      return `${who} bought a Divine Coin.`;
    case 'prophecyGuessed':
      return `${who} guessed ${name(G, d.targetId)} is ${prophecyName(G, d.prophecyId)}: ${d.correct ? 'correct!' : 'wrong.'}`;
    case 'playerEliminated':
      return `${who} was eliminated. Their Prophecy was ${prophecyName(G, d.prophecyId)}.${d.reviving ? ' They will return next turn (Revival).' : ''}`;
    case 'prophecyReplaced':
      return `${who}'s Prophecy was replaced.`;
    case 'matchEnded':
      return 'The admin ended this game.';
    case 'gameWon':
      return d.reason === 'prophecy'
        ? `${who} revealed ${prophecyName(G, d.prophecyId)} and won the game!`
        : `${who} is the last player standing and wins!`;
    default:
      return null;
  }
}
