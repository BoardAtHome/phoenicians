import { describe, expect, it } from 'vitest';
import { baselineConfig, validateConfig } from '../src';

const clone = () => structuredClone(baselineConfig);

describe('baseline config', () => {
  it('is valid', () => {
    expect(validateConfig(baselineConfig)).toEqual([]);
  });

  it('has a 200-card Expedition deck with 30 Calamities', () => {
    const resources = Object.values(baselineConfig.expedition.resourceCards).reduce((a, b) => a + b, 0);
    const calamities = baselineConfig.expedition.calamities.reduce((a, c) => a + c.copies, 0);
    expect(resources).toBe(170);
    expect(calamities).toBe(30);
  });

  it('has 12 buildings, 20 curses and 8 prophecies', () => {
    expect(baselineConfig.structures).toHaveLength(12);
    expect(baselineConfig.curses).toHaveLength(20);
    expect(baselineConfig.prophecies).toHaveLength(8);
  });
});

describe('validateConfig', () => {
  it('rejects min players above max', () => {
    const c = clone();
    c.players.min = 8;
    expect(validateConfig(c).join()).toMatch(/players.min must not exceed/);
  });

  it('rejects negative or fractional numbers', () => {
    const c = clone();
    c.structures[0]!.cost.buildingMaterials = -1;
    c.expedition.calamities[0]!.copies = 1.5;
    expect(validateConfig(c)).toHaveLength(2);
  });

  it('rejects too few prophecies for the maximum player count', () => {
    const c = clone();
    c.players.max = 9;
    expect(validateConfig(c).join()).toMatch(/prophecies have 8 copies/);
  });

  it('rejects too few curses for starting hands', () => {
    const c = clone();
    for (const curse of c.curses) curse.copies = 1;
    expect(validateConfig(c).join()).toMatch(/curses have 20 copies/);
  });

  it('rejects duplicate ids', () => {
    const c = clone();
    c.structures[1]!.id = c.structures[0]!.id;
    expect(validateConfig(c).join()).toMatch(/duplicate id/);
  });

  it('rejects starting resources the deck cannot supply', () => {
    const c = clone();
    c.setup.startingResources.warriors = 5;
    expect(validateConfig(c).join()).toMatch(/warriors cards/);
  });
});
