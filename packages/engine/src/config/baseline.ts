import type { GameConfig, ResourceMap } from './types';

const cost = (buildingMaterials = 0, warriors = 0, grain = 0, purpleDye = 0): ResourceMap => ({
  buildingMaterials,
  warriors,
  grain,
  purpleDye,
});

/**
 * Baseline configuration from the rulebook, developer spec and Jamil's
 * answers of 24 October 2026. Curse copy counts are a placeholder (2 each)
 * until they are set before the first playtest.
 */
export const baselineConfig: GameConfig = {
  players: { min: 3, max: 7 },
  setup: {
    startingResources: cost(),
    startingCurses: 3,
    curseHandLimit: null,
    divineCoins: 0,
  },
  expedition: {
    resourceCards: cost(55, 30, 55, 30),
    calamities: [
      { id: 'discard-expedition', name: 'Discard entire current expedition', copies: 10, effect: { kind: 'discardExpedition' } },
      { id: 'discard-5', name: 'Discard 5 existing inventory cards', copies: 2, effect: { kind: 'discardInventoryCount', count: 5 } },
      { id: 'discard-4', name: 'Discard 4 existing inventory cards', copies: 2, effect: { kind: 'discardInventoryCount', count: 4 } },
      { id: 'discard-purple-dye', name: 'Discard all Purple Dye from existing inventory', copies: 2, effect: { kind: 'discardInventoryResource', resource: 'purpleDye' } },
      { id: 'discard-warriors', name: 'Discard all Warriors from existing inventory', copies: 2, effect: { kind: 'discardInventoryResource', resource: 'warriors' } },
      { id: 'discard-building-materials', name: 'Discard all Building Materials from existing inventory', copies: 2, effect: { kind: 'discardInventoryResource', resource: 'buildingMaterials' } },
      { id: 'discard-grain', name: 'Discard all Grain from existing inventory', copies: 2, effect: { kind: 'discardInventoryResource', resource: 'grain' } },
      { id: 'discard-half', name: 'Discard half of existing inventory, rounded up', copies: 8, effect: { kind: 'discardInventoryFraction', fraction: 0.5, rounding: 'up' } },
    ],
    ignoredCalamityDraws: 1,
  },
  shop: { slots: 6 },
  structures: [
    { id: 'shipyard', name: 'Shipyard', category: 'civic', cost: cost(10), copies: 2 },
    { id: 'temple-of-baal', name: 'Temple of Baal', category: 'civic', cost: cost(15), copies: 2 },
    { id: 'cedar-workshop', name: 'Cedar Workshop', category: 'civic', cost: cost(11), copies: 2 },
    { id: 'archer-tower', name: 'Archer Tower', category: 'military', cost: cost(4, 1), copies: 2 },
    { id: 'barracks', name: 'Barracks', category: 'military', cost: cost(7, 2), copies: 2 },
    { id: 'watchtower', name: 'Watchtower', category: 'military', cost: cost(7, 3), copies: 2 },
    { id: 'farm', name: 'Farm', category: 'agricultural', cost: cost(8, 0, 2), copies: 2 },
    { id: 'marketplace', name: 'Marketplace', category: 'agricultural', cost: cost(5, 0, 5), copies: 2 },
    { id: 'temple-of-astarte', name: 'Temple of Astarte', category: 'agricultural', cost: cost(10, 0, 4), copies: 2 },
    { id: 'purple-dye-workshop', name: 'Purple Dye Workshop', category: 'commercial', cost: cost(5, 0, 0, 3), copies: 2 },
    { id: 'palace', name: 'Palace', category: 'commercial', cost: cost(12, 0, 0, 3), copies: 2 },
    { id: 'trading-post', name: 'Trading Post', category: 'commercial', cost: cost(4, 0, 0, 2), copies: 2 },
  ],
  costs: {
    attack: cost(0, 3),
    ritual: cost(0, 0, 4),
    divineCoin: cost(0, 0, 0, 5),
    guessProphecy: 1,
  },
  prophecies: [
    { id: 'conqueror', name: 'The Conqueror', evaluation: 'cumulative', metric: { kind: 'structuresDestroyed' }, threshold: 5, copies: 1 },
    { id: 'great-builder', name: 'The Great Builder', evaluation: 'conditional', metric: { kind: 'structuresOwned' }, threshold: 7, copies: 1 },
    { id: 'high-priest', name: 'The High Priest', evaluation: 'cumulative', metric: { kind: 'ritualsPerformed' }, threshold: 5, copies: 1 },
    { id: 'warlord', name: 'The Warlord', evaluation: 'conditional', metric: { kind: 'structuresOwned', category: 'military' }, threshold: 4, copies: 1 },
    { id: 'harvest-king', name: 'The Harvest King', evaluation: 'conditional', metric: { kind: 'structuresOwned', category: 'agricultural' }, threshold: 4, copies: 1 },
    { id: 'merchant-prince', name: 'The Merchant Prince', evaluation: 'conditional', metric: { kind: 'structuresOwned', category: 'commercial' }, threshold: 4, copies: 1 },
    { id: 'city-founder', name: 'The City Founder', evaluation: 'conditional', metric: { kind: 'structuresOwned', category: 'civic' }, threshold: 3, copies: 1 },
    { id: 'wealthy-merchant', name: 'The Wealthy Merchant', evaluation: 'conditional', metric: { kind: 'resourceHeld', resource: 'purpleDye' }, threshold: 8, copies: 1 },
  ],
  curses: [
    { id: 'resource-exchange', name: 'Resource Exchange', stars: 1, copies: 2, params: { exchange: 1 }, text: 'Exchange one selected resource in your inventory for one selected resource card in the Expedition discard pile.' },
    { id: 'petty-theft', name: 'Petty Theft', stars: 1, copies: 2, params: { steal: 2 }, text: 'Choose an opponent and steal two randomly selected resources from their inventory.' },
    { id: 'divine-foresight', name: 'Divine Foresight', stars: 1, copies: 2, params: { view: 3 }, text: 'View the next three Expedition cards and rearrange them.' },
    { id: 'expedition-interruption', name: 'Expedition Interruption', stars: 1, copies: 2, params: {}, text: "Immediately end another player's ongoing expedition." },
    { id: 'attack-negation', name: 'Attack Negation', stars: 1, copies: 2, params: {}, text: 'Cancel an attack initiated by another player, regardless of its target.' },
    { id: 'curse-negation', name: 'Curse Negation', stars: 1, copies: 2, params: {}, text: 'Cancel a Curse played against you.' },
    { id: 'calamity-protection', name: 'Calamity Protection', stars: 1, copies: 2, params: {}, text: 'Ignore the effect of a Calamity you draw and continue the expedition.' },
    { id: 'mass-theft', name: 'Mass Theft', stars: 2, copies: 2, params: { stealPerOpponent: 1 }, text: 'Steal one randomly selected resource from every opponent.' },
    { id: 'extra-expedition', name: 'Extra Expedition', stars: 2, copies: 2, params: {}, text: 'Undertake an additional expedition, including outside your turn.' },
    { id: 'forced-exploration', name: 'Forced Exploration', stars: 2, copies: 2, params: { extraDraws: 3 }, text: 'Choose an exploring player; they must draw three more Expedition cards before voluntarily stopping.' },
    { id: 'expedition-theft', name: 'Expedition Theft', stars: 2, copies: 2, params: {}, text: "Steal resources collected during another player's current expedition before they cash out." },
    { id: 'construction-ban', name: 'Construction Ban', stars: 2, copies: 2, params: { turns: 1 }, text: 'Choose a player; they cannot construct buildings during their next turn.' },
    { id: 'market-manipulation', name: 'Market Manipulation', stars: 2, copies: 2, params: {}, text: 'Return all six face-up shop buildings to the building deck, shuffle, and reveal six replacements.' },
    { id: 'forced-conflict', name: 'Forced Conflict', stars: 2, copies: 2, params: {}, text: 'Choose Player A; if they have enough Warriors, they must attack a structure belonging to another player, Player B. Player A chooses the target structure.' },
    { id: 'resource-purge', name: 'Resource Purge', stars: 3, copies: 2, params: {}, text: 'Choose a player and resource type; they discard all cards of that type from inventory.' },
    { id: 'revival', name: 'Revival', stars: 3, copies: 2, params: { buildingMaterials: 1 }, text: 'If eliminated, return at the beginning of your next turn with one Building Material, provided the game has not ended.' },
    { id: 'military-sabotage', name: 'Military Sabotage', stars: 3, copies: 2, params: { warriorsPerStructure: 3 }, text: 'Choose a player; destroy one of their structures for every three Warriors in their inventory.' },
    { id: 'divine-interception', name: 'Divine Interception', stars: 3, copies: 2, params: {}, text: 'When another player performs a ritual, take the Curse they would have received.' },
    { id: 'structural-burden', name: 'Structural Burden', stars: 3, copies: 2, params: { discardPerStructure: 1 }, text: 'Choose a player; they discard one resource card per structure they own.' },
    { id: 'prophecy-disruption', name: 'Prophecy Disruption', stars: 3, copies: 2, params: {}, text: 'Choose a player; discard their current Prophecy and give them a randomly drawn replacement.' },
  ],
  reactions: { windowSeconds: 5, holdSeconds: 30 },
};
