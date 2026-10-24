import { RESOURCES, type Resource } from './config/types';
import { destroyStructure, refillShop } from './actions';
import { addToInventory, canAfford, inventorySize, takeFromInventory } from './inventory';
import { replaceProphecy } from './prophecy';
import { shuffle, type Rng } from './rng';
import type { GameState, Player, ResourceCard, Result } from './state';
import { fail, ok } from './state';
import { checkActive } from './turn';
import { getPlayer, log } from './util';

/** What a player supplies when playing a Curse. Which fields matter depends on the Curse. */
export interface CurseTarget {
  playerId?: string;
  /** Forced Conflict: the player whose structure gets attacked. */
  secondPlayerId?: string;
  resource?: Resource;
  /** Resource Exchange: what you give from inventory and what you take from the discard pile. */
  give?: Resource;
  take?: Resource;
  /** Military Sabotage: which of the target's structures to destroy. */
  structureCardIds?: string[];
}

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

/** Plays a Curse from the player's hand during their own action phase. Played Curses are public. */
export function playCurse(state: GameState, playerId: string, curseCardId: string, target: CurseTarget, rng: Rng): Result {
  const check = checkActive(state, playerId, 'action');
  if (!check.ok) return check;
  const player = getPlayer(state, playerId)!;
  const card = player.curseHand.find((c) => c.id === curseCardId);
  if (!card) return fail('That Curse is not in your hand');
  if (REACTIVE_CURSES.has(card.curseId)) return fail('This Curse is played in response to another action');
  const curse = state.config.curses.find((c) => c.id === card.curseId)!;
  const params = curse.params;

  const fields = CURSE_TARGETS[curse.id] ?? [];
  const targetPlayer = target.playerId ? getPlayer(state, target.playerId) : undefined;
  if (fields.includes('opponent') || fields.includes('player')) {
    if (!targetPlayer || targetPlayer.eliminated) return fail('Choose a player still in the game');
    if (fields.includes('opponent') && targetPlayer.id === playerId) return fail('Choose an opponent');
  }

  // Validate first, then apply, so a failed play changes nothing.
  let apply: () => void;
  switch (curse.id) {
    case 'resource-exchange': {
      const { give, take } = target;
      const count = params.exchange ?? 1;
      if (!give || !take) return fail('Choose what to give and what to take');
      if (player.inventory[give].length < count) return fail(`You need ${count} ${give} to give`);
      const available = state.expeditionDiscard.filter((c): c is ResourceCard => c.type === 'resource' && c.resource === take);
      if (available.length < count) return fail(`The discard pile has no ${take} to take`);
      apply = () => {
        state.expeditionDiscard.push(...player.inventory[give].splice(-count));
        for (const c of available.slice(-count)) state.expeditionDiscard.splice(state.expeditionDiscard.indexOf(c), 1);
        addToInventory(player.inventory, available.slice(-count));
      };
      break;
    }
    case 'petty-theft':
      apply = () => void stealRandom(targetPlayer!, player, params.steal ?? 2, rng);
      break;
    case 'mass-theft':
      apply = () => {
        for (const other of state.players) {
          if (other.id !== playerId && !other.eliminated) stealRandom(other, player, params.stealPerOpponent ?? 1, rng);
        }
      };
      break;
    case 'divine-foresight': {
      const count = Math.min(params.view ?? 3, state.expeditionDeck.length);
      if (count === 0) return fail('The Expedition deck is empty');
      apply = () => {
        state.pendingChoice = { kind: 'arrangeExpedition', playerId, count };
      };
      break;
    }
    case 'extra-expedition':
      apply = () => {
        state.turn.extraExpeditions++;
      };
      break;
    case 'construction-ban':
      apply = () => {
        targetPlayer!.constructionBans += params.turns ?? 1;
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
      };
      break;
    case 'forced-conflict': {
      const victim = target.secondPlayerId ? getPlayer(state, target.secondPlayerId) : undefined;
      if (!victim || victim.eliminated || victim.id === targetPlayer!.id) return fail('Choose a second player to be attacked');
      apply = () => {
        // Nothing happens if Player A cannot afford an attack or Player B has nothing to attack.
        if (canAfford(targetPlayer!.inventory, state.config.costs.attack) && victim.structures.length > 0) {
          state.pendingChoice = { kind: 'forcedAttack', playerId: targetPlayer!.id, targetId: victim.id };
        }
      };
      break;
    }
    case 'resource-purge': {
      const resource = target.resource;
      if (!resource || !RESOURCES.includes(resource)) return fail('Choose a resource');
      apply = () => {
        state.expeditionDiscard.push(...targetPlayer!.inventory[resource].splice(0));
      };
      break;
    }
    case 'military-sabotage': {
      const count = sabotageCount(state, targetPlayer!);
      const chosen = target.structureCardIds ?? [];
      if (new Set(chosen).size !== count || !chosen.every((id) => targetPlayer!.structures.some((s) => s.id === id))) {
        return fail(`Choose exactly ${count} of their structures`);
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
        } else if (count > 0) {
          state.pendingChoice = { kind: 'discardInventory', playerId: targetPlayer!.id, count, source: { type: 'curse', curseId: curse.id } };
        }
      };
      break;
    }
    case 'prophecy-disruption':
      if (state.prophecyDeck.length === 0 && state.prophecyDiscard.length === 0) return fail('No Prophecy cards are left to draw');
      apply = () => void replaceProphecy(state, targetPlayer!.id, rng);
      break;
    default:
      return fail('This Curse cannot be played yet');
  }

  player.curseHand.splice(player.curseHand.indexOf(card), 1);
  state.curseDiscard.push(card);
  log(state, 'cursePlayed', playerId, { curseId: curse.id, targetId: target.playerId, secondPlayerId: target.secondPlayerId, resource: target.resource });
  apply();
  return ok;
}

/** Divine Foresight follow-up: the new order of the top cards, given as card ids, top card first. */
export function arrangeExpedition(state: GameState, playerId: string, order: string[]): Result {
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
  const attacker = getPlayer(state, playerId)!;
  const victim = getPlayer(state, pending.targetId)!;
  if (!victim.structures.some((s) => s.id === structureCardId)) return fail(`Choose one of ${victim.name}'s structures`);
  state.expeditionDiscard.push(...takeFromInventory(attacker.inventory, state.config.costs.attack));
  state.pendingChoice = null;
  log(state, 'attacked', playerId, { targetId: victim.id, structureCardId, forced: true });
  return destroyStructure(state, victim.id, structureCardId, playerId, rng);
}
