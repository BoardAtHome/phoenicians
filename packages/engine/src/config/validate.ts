import { RESOURCES, STRUCTURE_CATEGORIES, type GameConfig, type ResourceMap } from './types';

/** Returns a list of human-readable problems. An empty list means the config is valid. */
export function validateConfig(config: GameConfig): string[] {
  const errors: string[] = [];
  const count = (path: string, value: number, min = 0) => {
    if (!Number.isInteger(value) || value < min) errors.push(`${path} must be a whole number ≥ ${min} (got ${value})`);
  };
  const resources = (path: string, map: ResourceMap) => {
    for (const r of RESOURCES) count(`${path}.${r}`, map[r]);
  };
  const uniqueIds = (path: string, items: { id: string }[]) => {
    const seen = new Set<string>();
    for (const { id } of items) {
      if (seen.has(id)) errors.push(`${path} has duplicate id "${id}"`);
      seen.add(id);
    }
  };

  count('players.min', config.players.min, 1);
  count('players.max', config.players.max, 1);
  if (config.players.min > config.players.max) errors.push('players.min must not exceed players.max');

  resources('setup.startingResources', config.setup.startingResources);
  count('setup.startingCurses', config.setup.startingCurses);
  count('setup.divineCoins', config.setup.divineCoins);
  if (config.setup.curseHandLimit !== null) count('setup.curseHandLimit', config.setup.curseHandLimit);

  resources('expedition.resourceCards', config.expedition.resourceCards);
  count('expedition.ignoredCalamityDraws', config.expedition.ignoredCalamityDraws);
  uniqueIds('expedition.calamities', config.expedition.calamities);
  config.expedition.calamities.forEach((c, i) => {
    const path = `expedition.calamities[${i}]`;
    count(`${path}.copies`, c.copies);
    if (c.effect.kind === 'discardInventoryCount') count(`${path}.effect.count`, c.effect.count);
    if (c.effect.kind === 'discardInventoryResource' && !RESOURCES.includes(c.effect.resource)) {
      errors.push(`${path}.effect.resource is not a resource`);
    }
    if (c.effect.kind === 'discardInventoryFraction' && !(c.effect.fraction >= 0 && c.effect.fraction <= 1)) {
      errors.push(`${path}.effect.fraction must be between 0 and 1`);
    }
  });

  count('shop.slots', config.shop.slots);
  uniqueIds('structures', config.structures);
  config.structures.forEach((s, i) => {
    if (!STRUCTURE_CATEGORIES.includes(s.category)) errors.push(`structures[${i}].category is not a category`);
    resources(`structures[${i}].cost`, s.cost);
    count(`structures[${i}].copies`, s.copies);
  });

  resources('costs.attack', config.costs.attack);
  resources('costs.ritual', config.costs.ritual);
  resources('costs.divineCoin', config.costs.divineCoin);
  count('costs.guessProphecy', config.costs.guessProphecy);

  uniqueIds('prophecies', config.prophecies);
  config.prophecies.forEach((p, i) => {
    count(`prophecies[${i}].threshold`, p.threshold, 1);
    count(`prophecies[${i}].copies`, p.copies);
  });
  const prophecyCopies = config.prophecies.reduce((n, p) => n + p.copies, 0);
  if (prophecyCopies < config.players.max) {
    errors.push(`prophecies have ${prophecyCopies} copies in total but ${config.players.max} players each need one`);
  }

  uniqueIds('curses', config.curses);
  config.curses.forEach((c, i) => {
    count(`curses[${i}].copies`, c.copies);
    for (const [k, v] of Object.entries(c.params)) count(`curses[${i}].params.${k}`, v);
  });
  const curseCopies = config.curses.reduce((n, c) => n + c.copies, 0);
  const curseNeeded = config.setup.startingCurses * config.players.max;
  if (curseCopies < curseNeeded) {
    errors.push(`curses have ${curseCopies} copies in total but ${config.players.max} players × ${config.setup.startingCurses} starting curses need ${curseNeeded}`);
  }

  const startingNeeded = RESOURCES.map((r) => [r, config.setup.startingResources[r] * config.players.max] as const);
  for (const [r, needed] of startingNeeded) {
    if (needed > config.expedition.resourceCards[r]) {
      errors.push(`expedition has ${config.expedition.resourceCards[r]} ${r} cards but starting resources for ${config.players.max} players need ${needed}`);
    }
  }

  if (!(config.reactions.windowSeconds >= 0)) errors.push('reactions.windowSeconds must be ≥ 0');
  if (config.reactions.holdSeconds !== undefined && !(config.reactions.holdSeconds >= 0)) {
    errors.push('reactions.holdSeconds must be ≥ 0');
  }

  return errors;
}
