import { RESOURCES, type Resource } from './config/types';
import { destroyStructure, refillShop, startAttack } from './actions';
import { addToInventory, canAfford, inventorySize, takeFromInventory } from './inventory';
import { replaceProphecy } from './prophecy';
import { finishExpedition } from './expedition';
import { shuffle, type Rng } from './rng';
import { canPlayInWindow, continueResolution, pushEntry, topEntry } from './reactions';
import type { CurseTargetInput, GameState, Player, ResourceCard, Result, StackEntry } from './state';
import { fail, ok } from './state';
import { getPlayer, log } from './util';

export type CurseTarget = CurseTargetInput;

export type TargetField = 'opponent' | 'player' | 'secondPlayer' | 'resource' | 'exchange' | 'structures';

/** The inputs each Curse needs, so the client can build its form. Missing = no inputs. */
export const CURSE_TARGETS: Record<string, TargetField[]> = {
  'resource-exchange': ['exchange'],
  'petty-theft': ['opponent'],
  'divine-foresight': [],
  'mass-theft': [],
  'extra-expedition': [],
  'construction-ban': ['opponent'],
  'market-manipulation': [],
  'forced-conflict': ['player', 'secondPlayer'],
  'resource-purge': ['player', 'resource'],
  'military-sabotage': ['player', 'structures'],
  'structural-burden': ['player'],
  'prophecy-disruption': ['player'],
};

/** Curses that respond to other players' actions. They arrive with reaction windows. */
export const REACTIVE_CURSES = new Set([
  'attack-negation',
  'curse-negation',
  'divine-interception',
  'expedition-interruption',
  'expedition-theft',
  'forced-exploration',
  'calamity-protection',
  'revival',
]);

/** Moves `count` randomly chosen resource cards from one inventory to another. */
function stealRandom(from: Player, to: Player, count: number, rng: Rng): number {
  let stolen = 0;
  for (; stolen < count; stolen++) {
    const pool = RESOURCES.flatMap((r) => from.inventory[r]);
    if (pool.length === 0) break;
    const card = pool[Math.floor(rng.next() * pool.length)]!;
    const list = from.inventory[card.resource];
    list.splice(list.indexOf(card), 1);
    to.inventory[card.resource].push(card);
  }
  return stolen;
}

const hasResources = (p: Player) => inventorySize(p.inventory) > 0;

/**
 * Why playing this Curse now would do nothing, or null if it would have an effect. A Curse with
 * no effect can't be played, so it isn't used up for nothing. Targets not chosen yet count as
 * "any target": the Curse is blocked only if no choice would work. Uses public information only,
 * so the client can grey Curses out; hidden deck checks stay in `prepareCurse`.
 */
export function curseNoEffectReason(state: GameState, playerId: string, curseId: string, target: CurseTarget = {}): string | null {
  const live = state.players.filter((p) => !p.eliminated);
  const opponents = live.filter((p) => p.id !== playerId);
  const chosen = target.playerId ? getPlayer(state, target.playerId) : undefined;
  const params = state.config.curses.find((c) => c.id === curseId)?.params ?? {};
  switch (curseId) {
    case 'resource-exchange': {
      const count = params.exchange ?? 1;
      const me = getPlayer(state, playerId)!;
      const inDiscard = (r: Resource) => state.expeditionDiscard.filter((c) => c.type === 'resource' && c.resource === r).length;
      if (!RESOURCES.some((r) => me.inventory[r].length >= count)) return `You need ${count} of a resource to give`;
      if (!RESOURCES.some((r) => inDiscard(r) >= count)) return 'The discard pile has no resources to take';
      return null;
    }
    case 'petty-theft':
      if (chosen) return hasResources(chosen) ? null : `${chosen.name} has no resources to steal`;
      return opponents.some(hasResources) ? null : 'No opponent has any resources to steal';
    case 'mass-theft':
      return opponents.some(hasResources) ? null : 'No opponent has any resources to steal';
    case 'resource-purge':
      if (chosen && target.resource) return chosen.inventory[target.resource].length > 0 ? null : `${chosen.name} has none of that resource`;
      if (chosen) return hasResources(chosen) ? null : `${chosen.name} has no resources`;
      return live.some(hasResources) ? null : 'No player has any resources';
    case 'military-sabotage':
      if (chosen) return sabotageCount(state, chosen) > 0 ? null : `${chosen.name} has too few Warriors to lose a structure`;
      return live.some((p) => sabotageCount(state, p) > 0) ? null : 'No player has enough Warriors to lose a structure';
    case 'structural-burden': {
      const burdens = (p: Player) => burdenCount(state, p) > 0 && hasResources(p);
      if (chosen) return burdens(chosen) ? null : `${chosen.name} would discard nothing`;
      return live.some(burdens) ? null : 'No player would discard anything';
    }
    case 'forced-conflict': {
      const second = target.secondPlayerId ? getPlayer(state, target.secondPlayerId) : undefined;
      const canAttack = (p: Player) => canAfford(p.inventory, state.config.costs.attack);
      const attackable = (p: Player, attacker?: Player) => p.id !== attacker?.id && p.structures.length > 0;
      if (chosen && !canAttack(chosen)) return `${chosen.name} can't afford an attack`;
      if (second && !attackable(second, chosen)) return `${second.name} has no structures to attack`;
      const attackers = chosen ? [chosen] : live.filter(canAttack);
      const ok = attackers.some((a) => (second ? [second] : live).some((b) => attackable(b, a)));
      return ok ? null : 'No player can afford an attack on someone with structures';
    }
    default:
      return null;
  }
}

/** Military Sabotage: how many structures the target loses. */
export const sabotageCount = (state: GameState, target: Player): number => {
  const per = state.config.curses.find((c) => c.id === 'military-sabotage')?.params.warriorsPerStructure ?? 3;
  return Math.min(target.structures.length, Math.floor(target.inventory.warriors.length / Math.max(1, per)));
};

/** Structural Burden: how many cards the target discards. */
export const burdenCount = (state: GameState, target: Player): number => {
  const per = state.config.curses.find((c) => c.id === 'structural-burden')?.params.discardPerStructure ?? 1;
  return target.structures.length * per;
};

type Prepared = { apply: () => void; affects: string[] } | { error: string };
const no = (error: string): Prepared => ({ error });

/**
 * Checks a Curse can take effect and returns how to apply it. Run once when it is played and again
 * when it resolves, since other responses may have changed things in between (then it fizzles).
 * `entryId` is the stack entry a reactive Curse answers.
 */
export function prepareCurse(state: GameState, playerId: string, curseId: string, target: CurseTarget, entryId: number | null, rng: Rng): Prepared {
  const player = getPlayer(state, playerId)!;
  const curse = state.config.curses.find((c) => c.id === curseId);
  if (!curse) return no('Unknown Curse');
  const params = curse.params;
  if (REACTIVE_CURSES.has(curseId)) return prepareResponse(state, player, curseId, entryId, params, rng);

  const fields = CURSE_TARGETS[curse.id] ?? [];
  const targetPlayer = target.playerId ? getPlayer(state, target.playerId) : undefined;
  if (fields.includes('opponent') || fields.includes('player')) {
    if (!targetPlayer || targetPlayer.eliminated) return no('Choose a player still in the game');
    if (fields.includes('opponent') && targetPlayer.id === playerId) return no('Choose an opponent');
  }
  const against = (...ids: (string | undefined)[]) => ids.filter((id): id is string => !!id && id !== playerId);
  let affects = against(targetPlayer?.id);
  const noEffect = curseNoEffectReason(state, playerId, curse.id, target);
  if (noEffect) return no(noEffect);

  let apply: () => void;
  switch (curse.id) {
    case 'resource-exchange': {
      const { give, take } = target;
      const count = params.exchange ?? 1;
      if (!give || !take) return no('Choose what to give and what to take');
      if (player.inventory[give].length < count) return no(`You need ${count} ${give} to give`);
      const available = state.expeditionDiscard.filter((c): c is ResourceCard => c.type === 'resource' && c.resource === take);
      if (available.length < count) return no(`The discard pile has no ${take} to take`);
      apply = () => {
        state.expeditionDiscard.push(...player.inventory[give].splice(-count));
        for (const c of available.slice(-count)) state.expeditionDiscard.splice(state.expeditionDiscard.indexOf(c), 1);
        addToInventory(player.inventory, available.slice(-count));
        log(state, 'curseResolved', playerId, { curseId: curse.id, give, take, count });
      };
      break;
    }
    case 'petty-theft':
    case 'mass-theft': {
      const victims = curse.id === 'petty-theft' ? [targetPlayer!] : state.players.filter((p) => p.id !== playerId && !p.eliminated);
      if (curse.id === 'mass-theft') affects = against(...victims.map((p) => p.id));
      const count = curse.id === 'petty-theft' ? (params.steal ?? 2) : (params.stealPerOpponent ?? 1);
      apply = () => {
        // Logged so the table can see what the Curse took, not just that it was played.
        const from: Record<string, number> = {};
        for (const victim of victims) {
          const stolen = stealRandom(victim, player, count, rng);
          if (stolen > 0) from[victim.id] = stolen;
        }
        log(state, 'resourcesStolen', playerId, { curseId: curse.id, from });
      };
      break;
    }
    case 'divine-foresight': {
      const count = Math.min(params.view ?? 3, state.expeditionDeck.length);
      if (count === 0) return no('The Expedition deck is empty');
      apply = () => {
        state.pendingChoice = { kind: 'arrangeExpedition', playerId, count };
      };
      break;
    }
    case 'extra-expedition':
      apply = () => {
        // Played outside your own turn, the expedition runs as soon as the current turn ends.
        const outOfTurn = state.turn.activePlayerId !== playerId;
        if (outOfTurn) state.extraExpeditionQueue.push(playerId);
        else state.turn.extraExpeditions++;
        log(state, 'curseResolved', playerId, { curseId: curse.id, outOfTurn });
      };
      break;
    case 'construction-ban':
      apply = () => {
        targetPlayer!.constructionBans += params.turns ?? 1;
        log(state, 'curseResolved', playerId, { curseId: curse.id, targetId: targetPlayer!.id, turns: params.turns ?? 1 });
      };
      break;
    case 'market-manipulation':
      apply = () => {
        for (let i = 0; i < state.shop.length; i++) {
          const shopCard = state.shop[i];
          if (shopCard) state.buildingDeck.push(shopCard);
          state.shop[i] = null;
        }
        shuffle(rng, state.buildingDeck);
        refillShop(state);
        log(state, 'curseResolved', playerId, { curseId: curse.id });
      };
      break;
    case 'forced-conflict': {
      const victim = target.secondPlayerId ? getPlayer(state, target.secondPlayerId) : undefined;
      if (!victim || victim.eliminated || victim.id === targetPlayer!.id) return no('Choose a second player to be attacked');
      affects = against(targetPlayer!.id, victim.id);
      apply = () => {
        // Nothing happens if Player A cannot afford an attack or Player B has nothing to attack.
        if (canAfford(targetPlayer!.inventory, state.config.costs.attack) && victim.structures.length > 0) {
          state.pendingChoice = { kind: 'forcedAttack', playerId: targetPlayer!.id, targetId: victim.id };
        } else {
          log(state, 'curseResolved', playerId, { curseId: curse.id, targetId: targetPlayer!.id, secondPlayerId: victim.id, nothing: true });
        }
      };
      break;
    }
    case 'resource-purge': {
      const resource = target.resource;
      if (!resource || !RESOURCES.includes(resource)) return no('Choose a resource');
      apply = () => {
        const purged = targetPlayer!.inventory[resource].splice(0);
        state.expeditionDiscard.push(...purged);
        log(state, 'curseResolved', playerId, { curseId: curse.id, targetId: targetPlayer!.id, resource, count: purged.length });
      };
      break;
    }
    case 'military-sabotage': {
      const count = sabotageCount(state, targetPlayer!);
      const chosen = target.structureCardIds ?? [];
      if (new Set(chosen).size !== count || !chosen.every((id) => targetPlayer!.structures.some((s) => s.id === id))) {
        return no(`Choose exactly ${count} of their structures`);
      }
      apply = () => {
        for (const id of chosen) destroyStructure(state, targetPlayer!.id, id, playerId, rng);
      };
      break;
    }
    case 'structural-burden': {
      apply = () => {
        const count = burdenCount(state, targetPlayer!);
        const size = inventorySize(targetPlayer!.inventory);
        if (count >= size) {
          for (const r of RESOURCES) state.expeditionDiscard.push(...targetPlayer!.inventory[r].splice(0));
          log(state, 'curseResolved', playerId, { curseId: curse.id, targetId: targetPlayer!.id, count: size });
        } else if (count > 0) {
          state.pendingChoice = { kind: 'discardInventory', playerId: targetPlayer!.id, count, source: { type: 'curse', curseId: curse.id } };
        }
      };
      break;
    }
    case 'prophecy-disruption':
      if (state.prophecyDeck.length === 0 && state.prophecyDiscard.length === 0) return no('No Prophecy cards are left to draw');
      apply = () => void replaceProphecy(state, targetPlayer!.id, rng);
      break;
    default:
      return no('This Curse cannot be played yet');
  }

  return { apply, affects };
}

function prepareResponse(
  state: GameState,
  player: Player,
  curseId: string,
  entryId: number | null,
  params: Record<string, number>,
  rng: Rng,
): Prepared {
  const entry = state.stack.find((e) => e.id === entryId);
  if (!entry) return no('There is nothing to respond to');
  const expedition = state.expedition;
  const explorerId = entry.playerId;
  const cancel = (e: StackEntry) => () => {
    e.canceled = true;
  };
  switch (curseId) {
    case 'attack-negation':
      if (entry.kind !== 'attack') return no('Not an attack');
      return { affects: [entry.playerId], apply: cancel(entry) };
    case 'curse-negation':
      if (entry.kind !== 'curse' || !entry.affects.includes(player.id)) return no('Not a Curse played against you');
      return { affects: [entry.playerId], apply: cancel(entry) };
    case 'divine-interception':
      if (entry.kind !== 'ritual') return no('Not a ritual');
      return {
        affects: [entry.playerId],
        apply: () => {
          entry.interceptedBy = player.id;
        },
      };
    case 'calamity-protection':
      if (entry.kind !== 'calamity' || entry.playerId !== player.id) return no('Not a Calamity you drew');
      return { affects: [], apply: cancel(entry) };
    case 'revival':
      if (entry.kind !== 'eliminate' || entry.targetId !== player.id) return no('You are not being eliminated');
      return {
        affects: [],
        apply: () => {
          entry.revived = true;
        },
      };
    case 'expedition-interruption':
    case 'expedition-theft':
    case 'forced-exploration': {
      if (entry.kind !== 'moment' || entry.action !== 'draw' || expedition?.playerId !== explorerId) return no('That expedition is over');
      const exp = expedition!;
      if (curseId === 'expedition-theft' && exp.drawn.length === 0) return no('Nothing has been collected yet');
      const apply =
        curseId === 'expedition-interruption'
          ? () => finishExpedition(state, rng, 'interrupted')
          : curseId === 'expedition-theft'
            ? () => {
                const stolen = exp.drawn.splice(0);
                addToInventory(player.inventory, stolen);
                log(state, 'expeditionStolen', player.id, { from: explorerId, count: stolen.length });
              }
            : () => {
                exp.mustDraw += params.extraDraws ?? 3;
                log(state, 'curseResolved', player.id, { curseId, targetId: explorerId, draws: params.extraDraws ?? 3 });
              };
      return { affects: [explorerId], apply };
    }
    default:
      return no('This Curse cannot be played yet');
  }
}

/**
 * Plays a Curse from the player's hand: on your own turn with nothing pending, or as a response
 * while a reaction window is open. Played Curses are public and go on the stack.
 */
export function playCurse(state: GameState, playerId: string, curseCardId: string, target: CurseTarget, rng: Rng): Result {
  if (state.turn.phase === 'gameOver') return fail('The game is over');
  if (state.pendingChoice) return fail('Waiting for a choice to be made');
  const player = getPlayer(state, playerId)!;
  const card = player.curseHand.find((c) => c.id === curseCardId);
  if (!card) return fail('That Curse is not in your hand');
  const reactive = REACTIVE_CURSES.has(card.curseId);

  let entryId: number | null = null;
  if (state.window) {
    if (!canPlayInWindow(state, playerId, card.curseId)) return fail('You cannot play this Curse now');
    if (reactive) entryId = state.window.entryId;
  } else {
    if (state.turn.activePlayerId !== playerId) return fail('Outside your turn, Curses are played in a reaction window');
    if (state.stack.length > 0) return fail('Waiting for actions to resolve');
    if (reactive) return fail('This Curse is played in response to another action');
  }

  const prepared = prepareCurse(state, playerId, card.curseId, target, entryId, rng);
  if ('error' in prepared) return fail(prepared.error);

  player.curseHand.splice(player.curseHand.indexOf(card), 1);
  state.curseDiscard.push(card);
  const answering = state.window ? topEntry(state)?.kind : undefined;
  log(state, 'cursePlayed', playerId, {
    curseId: card.curseId,
    targetId: target.playerId,
    secondPlayerId: target.secondPlayerId,
    resource: target.resource,
    ...(answering ? { answering } : {}),
  });
  // A response takes over the window; the entry it answers gets a fresh one once the response resolves.
  state.window = null;
  pushEntry(state, { kind: 'curse', playerId, curseId: card.curseId, target, affects: prepared.affects, entryId });
  continueResolution(state, rng);
  return ok;
}

/** Divine Foresight follow-up: the new order of the top cards, given as card ids, top card first. */
export function arrangeExpedition(state: GameState, playerId: string, order: string[], rng: Rng): Result {
  const pending = state.pendingChoice;
  if (!pending || pending.kind !== 'arrangeExpedition' || pending.playerId !== playerId) return fail('Nothing to arrange');
  const top = state.expeditionDeck.slice(-pending.count); // last element is the top card
  const ids = top.map((c) => c.id);
  if (order.length !== ids.length || !order.every((id) => ids.includes(id)) || new Set(order).size !== order.length) {
    return fail('Give the same cards in a new order');
  }
  const reordered = [...order].reverse().map((id) => top.find((c) => c.id === id)!);
  state.expeditionDeck.splice(-pending.count, pending.count, ...reordered);
  state.pendingChoice = null;
  log(state, 'expeditionArranged', playerId);
  continueResolution(state, rng);
  return ok;
}

/** The top `count` Expedition cards, top first, for the Divine Foresight player only. */
export function foresightCards(state: GameState) {
  const pending = state.pendingChoice;
  if (!pending || pending.kind !== 'arrangeExpedition') return [];
  return state.expeditionDeck.slice(-pending.count).reverse();
}

/** Forced Conflict follow-up: Player A picks which of Player B's structures to attack, paying the attack cost. */
export function resolveForcedAttack(state: GameState, playerId: string, structureCardId: string, rng: Rng): Result {
  const pending = state.pendingChoice;
  if (!pending || pending.kind !== 'forcedAttack' || pending.playerId !== playerId) return fail('No forced attack is pending');
  const victim = getPlayer(state, pending.targetId)!;
  if (!victim.structures.some((s) => s.id === structureCardId)) return fail(`Choose one of ${victim.name}'s structures`);
  state.pendingChoice = null;
  startAttack(state, playerId, victim.id, structureCardId, rng, true);
  return ok;
}
