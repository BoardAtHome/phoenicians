import {
  RESOURCES,
  REACTIVE_CURSES,
  baselineConfig,
  type CalamityConfig,
  type CurseConfig,
  type GameConfig,
  type ProphecyConfig,
  type Resource,
  type StructureCategory,
  type StructureConfig,
} from '@phoenicians/engine';
import { CATEGORY_LABEL, RESOURCE_LABEL, costText } from './format';

/*
 * Helper text for new players. Every number comes from the game's config, so the
 * descriptions stay right when the admin changes a cost, a target or a Curse's numbers.
 */

const count = (n: number, word: string, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`;
const cards = (n: number) => count(n, 'card');
/** "A, B or C". */
const either = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`);
const both = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** The Prophecy's target, e.g. "Own 4 Military structures". */
export function prophecyGoal(p: ProphecyConfig): string {
  const m = p.metric;
  switch (m.kind) {
    case 'structuresDestroyed':
      return `Destroy ${count(p.threshold, 'structure')}`;
    case 'ritualsPerformed':
      return `Perform ${count(p.threshold, 'ritual')}`;
    case 'structuresOwned':
      return `Own ${p.threshold}${m.category ? ` ${CATEGORY_LABEL[m.category]}` : ''} ${p.threshold === 1 ? 'structure' : 'structures'}`;
    case 'resourceHeld':
      return `Hold ${p.threshold} ${RESOURCE_LABEL[m.resource]}`;
  }
}

export const evaluationLabel = (p: ProphecyConfig) => (p.evaluation === 'cumulative' ? 'Banked' : 'Hold');

export function evaluationHelp(p: ProphecyConfig): string {
  return p.evaluation === 'cumulative'
    ? 'Banked: counts what you have done. Progress never goes down, so once reached it stays reached.'
    : 'Hold: counts what you have right now. Rivals can knock you back below the target, so defend it.';
}

const inCategory = (config: GameConfig, category: StructureCategory) => config.structures.filter((s) => s.category === category);
const cardTotal = (s: StructureConfig) => RESOURCES.reduce((n, r) => n + s.cost[r], 0);

/** How to get there, e.g. "Build Archer Tower, Barracks or Watchtower. They cost Materials and Warriors." */
export function prophecyHow(config: GameConfig, p: ProphecyConfig): string {
  const m = p.metric;
  switch (m.kind) {
    case 'structuresDestroyed':
      return `Attack rival structures (${costText(config.costs.attack)} per attack). Structures you destroy with Military Sabotage count too.`;
    case 'ritualsPerformed':
      return `Spend ${costText(config.costs.ritual)} per ritual. Each ritual also gives you a Curse.`;
    case 'structuresOwned': {
      if (!m.category) return `Build anything from the Market, in any mix of kinds, and keep ${p.threshold} standing.`;
      const list = inCategory(config, m.category);
      if (list.length === 0) return `Build ${CATEGORY_LABEL[m.category]} structures.`;
      const used = RESOURCES.filter((r) => list.some((s) => s.cost[r] > 0)).map((r) => RESOURCE_LABEL[r]);
      const totals = list.map(cardTotal);
      const min = Math.min(...totals);
      const max = Math.max(...totals);
      const range = min === max ? cards(min) : `${min} to ${max} cards`;
      return `Build ${either(list.map((s) => s.name))}. They cost ${used.length === 1 ? `only ${used[0]}` : both(used)}, ${range} each.`;
    }
    case 'resourceHeld': {
      const spentOn = resourceUses(config, m.resource);
      return `Collect ${RESOURCE_LABEL[m.resource]} on expeditions and keep ${p.threshold} in your inventory.${spentOn.length ? ` Spending it (${both(spentOn)}) sets you back.` : ''}`;
    }
  }
}

/** What a resource pays for, e.g. ["attacks (3)", "Military buildings"]. */
export function resourceUses(config: GameConfig, r: Resource): string[] {
  const uses: string[] = [];
  const action = (cost: Record<Resource, number>, what: string) => cost[r] > 0 && uses.push(`${what} (${cost[r]} each)`);
  action(config.costs.ritual, 'rituals');
  action(config.costs.attack, 'attacks');
  action(config.costs.divineCoin, 'Divine Coins');
  const categories = (Object.keys(CATEGORY_LABEL) as StructureCategory[]).filter((c) => inCategory(config, c).some((s) => s.cost[r] > 0));
  if (categories.length === Object.keys(CATEGORY_LABEL).length) uses.push('every building');
  else if (categories.length > 0) uses.push(`${both(categories.map((c) => CATEGORY_LABEL[c]))} buildings`);
  return uses;
}

export function resourceHelp(config: GameConfig, r: Resource): string {
  const uses = resourceUses(config, r);
  const prophecies = config.prophecies.filter((p) => p.metric.kind === 'resourceHeld' && p.metric.resource === r).map((p) => p.name);
  const parts = [uses.length ? `Pays for ${both(uses)}.` : 'Not used to pay for anything.'];
  if (prophecies.length) parts.push(`${both(prophecies)} ${prophecies.length === 1 ? 'needs' : 'need'} you to hold it.`);
  return parts.join(' ');
}

/** The Prophecies a structure counts toward, with targets when `detailed`: "The Warlord (4 Military)". */
export function structureCountsToward(config: GameConfig, s: StructureConfig, detailed = false): string[] {
  return config.prophecies
    .filter((p) => p.metric.kind === 'structuresOwned' && (!p.metric.category || p.metric.category === s.category))
    .map((p) => {
      if (!detailed) return p.name;
      const m = p.metric as { category?: StructureCategory };
      return `${p.name} (${p.threshold}${m.category ? ` ${CATEGORY_LABEL[m.category]}` : ' of any kind'})`;
    });
}

export function structureHelp(config: GameConfig, s: StructureConfig, detailed = false): string {
  const toward = structureCountsToward(config, s, detailed);
  return toward.length ? `Counts toward ${both(toward)}.` : `No Prophecy counts ${CATEGORY_LABEL[s.category]} structures.`;
}

export const STRUCTURES_HELP =
  'Buildings have no powers of their own. They count toward Prophecies, and rivals can attack them. Build as many as you can afford during your actions.';

const baselineText = (id: string) => baselineConfig.curses.find((c) => c.id === id)?.text;

/** What a Curse does, with its numbers from the config. Card text the admin rewrote is shown as written. */
export function curseEffect(config: GameConfig, curse: CurseConfig): string {
  if (curse.text !== baselineText(curse.id)) return curse.text;
  const p = curse.params;
  switch (curse.id) {
    case 'resource-exchange':
      return `Give ${cards(p.exchange ?? 1)} of one resource from your inventory and take ${p.exchange === 1 || p.exchange === undefined ? 'one' : p.exchange} of another resource from the Expedition discard pile.`;
    case 'petty-theft':
      return `Steal ${count(p.steal ?? 2, 'random resource card')} from an opponent.`;
    case 'divine-foresight':
      return `Look at the next ${cards(p.view ?? 3)} of the Expedition deck and put them back in any order. Only you see them.`;
    case 'expedition-interruption':
      return "End another player's expedition right after they draw. They keep what they have drawn so far.";
    case 'attack-negation':
      return "Cancel another player's attack, whoever it targets. The attacker still pays for it.";
    case 'curse-negation':
      return 'Cancel a Curse played against you.';
    case 'calamity-protection':
      return 'Ignore a Calamity you draw and keep exploring. You must draw again before you can stop.';
    case 'mass-theft':
      return `Steal ${count(p.stealPerOpponent ?? 1, 'random resource card')} from every opponent.`;
    case 'extra-expedition':
      return 'Take another expedition. Played outside your turn, it happens as soon as the current turn ends.';
    case 'forced-exploration':
      return `Make an exploring player draw ${count(p.extraDraws ?? 3, 'more card')} before they may stop.`;
    case 'expedition-theft':
      return "Take every card another player has drawn on their current expedition, before they keep them.";
    case 'construction-ban': {
      const turns = p.turns ?? 1;
      return `An opponent cannot build during their next ${turns === 1 ? 'turn' : `${turns} turns`}.`;
    }
    case 'market-manipulation':
      return `Send all ${config.shop.slots} Market buildings back to the building deck, shuffle it, and reveal new ones.`;
    case 'forced-conflict':
      return `Choose Player A and Player B. If A can pay ${costText(config.costs.attack)}, A must attack one of B's structures. A picks which one and pays for it.`;
    case 'resource-purge':
      return 'Choose a player and a resource. They discard every card of that resource.';
    case 'revival':
      return `If a correct Prophecy guess eliminates you, you come back at your next turn with ${count(p.buildingMaterials ?? 1, 'Building Material')}, a new Prophecy and no Divine Coins.`;
    case 'military-sabotage':
      return `Choose a player. Destroy one of their structures for every ${p.warriorsPerStructure ?? 3} Warriors they hold. You pick which, and they count as destroyed by you.`;
    case 'divine-interception':
      return 'When another player performs a ritual, you take the Curse they would have drawn.';
    case 'structural-burden':
      return `Choose a player. They discard ${count(p.discardPerStructure ?? 1, 'resource card')} for each structure they own, of their choice.`;
    case 'prophecy-disruption':
      return 'Choose a player. Their Prophecy is swapped for a random new one. Banked progress (rituals, destructions) carries over.';
    default:
      return curse.text;
  }
}

/** When a Curse can be played. */
export function curseWhen(curseId: string): string {
  switch (curseId) {
    case 'attack-negation':
      return 'Reaction: offered when another player attacks.';
    case 'curse-negation':
      return 'Reaction: offered when a Curse is played against you.';
    case 'divine-interception':
      return 'Reaction: offered when another player performs a ritual.';
    case 'calamity-protection':
      return 'Reaction: offered when you draw a Calamity.';
    case 'expedition-interruption':
    case 'forced-exploration':
      return 'Reaction: offered when another player draws on an expedition.';
    case 'expedition-theft':
      return 'Reaction: offered when another player draws, once they have cards on their expedition.';
    case 'revival':
      return 'Reaction: offered when a correct guess would eliminate you.';
    default:
      return REACTIVE_CURSES.has(curseId) ? 'Reaction: offered when it applies.' : 'Play it during your turn, or in a reaction window on other turns.';
  }
}

/** What a Calamity does, from its effect. */
export function calamityHelp(c: CalamityConfig): string {
  const keep = 'The expedition ends and you keep the cards drawn on it.';
  const e = c.effect;
  switch (e.kind) {
    case 'discardExpedition':
      return 'You lose every card drawn on this expedition, and it ends.';
    case 'discardInventoryCount':
      return `Discard ${cards(e.count)} you already owned, of your choice. ${keep}`;
    case 'discardInventoryResource':
      return `Discard all the ${RESOURCE_LABEL[e.resource]} you already owned. ${keep}`;
    case 'discardInventoryFraction': {
      const share = e.fraction === 0.5 ? 'half' : `${Math.round(e.fraction * 100)}%`;
      return `Discard ${share} of the cards you already owned (rounded ${e.rounding}), of your choice. ${keep}`;
    }
  }
}

/** How expeditions work, e.g. for the guide and the Center. */
export function expeditionHelp(config: GameConfig): string {
  const safe = config.expedition.ignoredCalamityDraws;
  const safeText = safe <= 0 ? '' : ` The first ${safe === 1 ? 'card is' : `${safe} cards are`} safe: a Calamity there has no effect.`;
  return `Draw Expedition cards one at a time. Resource cards pile up in front of you, and you can stop after any resource to keep them all. Draw a Calamity and the expedition ends with a penalty.${safeText}`;
}

export function ritualHelp(): string {
  return 'Draw a Curse: a secret card with a special power you can play later.';
}

export function divineCoinHelp(config: GameConfig): string {
  return `Buy a coin. Spend ${count(config.costs.guessProphecy, 'Divine Coin')} to guess a rival's Prophecy.`;
}

export function attackHelp(): string {
  return "Destroy one of a rival's structures. They may cancel it with Attack Negation.";
}

export function guessHelp(): string {
  return "Name a rival's secret Prophecy. A right guess eliminates them; a wrong one only costs the coin.";
}

export const WIN_HELP =
  'You win when your secret Prophecy is still fulfilled at the start of your next turn: the game checks for you before you act. You also win as the last player standing.';
