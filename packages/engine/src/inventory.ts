import { RESOURCES, type ResourceMap } from './config/types';
import type { Inventory, ResourceCard } from './state';

export const emptyInventory = (): Inventory => ({ buildingMaterials: [], warriors: [], grain: [], purpleDye: [] });

export const inventorySize = (inv: Inventory): number => RESOURCES.reduce((n, r) => n + inv[r].length, 0);

export const inventoryCounts = (inv: Inventory): ResourceMap => ({
  buildingMaterials: inv.buildingMaterials.length,
  warriors: inv.warriors.length,
  grain: inv.grain.length,
  purpleDye: inv.purpleDye.length,
});

export const canAfford = (inv: Inventory, cost: ResourceMap): boolean => RESOURCES.every((r) => inv[r].length >= cost[r]);

/** Removes the given counts from the inventory and returns the removed cards. Caller checks affordability. */
export function takeFromInventory(inv: Inventory, counts: ResourceMap): ResourceCard[] {
  const taken: ResourceCard[] = [];
  for (const r of RESOURCES) taken.push(...inv[r].splice(inv[r].length - counts[r], counts[r]));
  return taken;
}

export function addToInventory(inv: Inventory, cards: ResourceCard[]): void {
  for (const card of cards) inv[card.resource].push(card);
}
