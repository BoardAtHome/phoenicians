import { describe, expect, it } from 'vitest';
import { baselineConfig } from '@phoenicians/engine';
import { AdminAuth } from '../src/auth';
import { ConfigError, ConfigStore, diffConfig, memoryPersistence } from '../src/configStore';

const open = () => ConfigStore.open(memoryPersistence(), '0.3.0');
const edit = (fn: (c: typeof baselineConfig) => void) => {
  const c = structuredClone(baselineConfig);
  fn(c);
  return c;
};

describe('ConfigStore', () => {
  it('starts with the baseline as version 1 and an empty draft', async () => {
    const store = await open();
    expect(store.active.id).toBe(1);
    expect(store.active.config).toEqual(baselineConfig);
    expect(store.draft.changes).toEqual([]);
  });

  it('piles noted changes into the draft without changing the active version', async () => {
    const store = await open();
    await store.saveDraft(edit((c) => (c.costs.attack.warriors = 4)), 'Attacks too cheap');
    await store.saveDraft(edit((c) => { c.costs.attack.warriors = 4; c.shop.slots = 5; }), 'Smaller shop');
    expect(store.draft.changes.map((c) => c.note)).toEqual(['Attacks too cheap', 'Smaller shop']);
    expect(store.draft.changes[1]!.changes).toEqual(['shop.slots: 6 → 5']);
    expect(store.active.config.costs.attack.warriors).toBe(3);
  });

  it('ignores saves with no changes and rejects invalid configs', async () => {
    const store = await open();
    expect(await store.saveDraft(structuredClone(baselineConfig), 'nothing')).toBeNull();
    await expect(store.saveDraft(edit((c) => (c.shop.slots = -1)), 'bad')).rejects.toBeInstanceOf(ConfigError);
    expect(store.draft.changes).toEqual([]);
  });

  it('publishes the draft as the next version and makes it active', async () => {
    const store = await open();
    await store.saveDraft(edit((c) => (c.costs.ritual.grain = 3)), 'Cheaper rituals');
    const v2 = await store.publish('Ritual tweak');
    expect(v2).toMatchObject({ id: 2, note: 'Ritual tweak', build: '0.3.0' });
    expect(v2.changes).toHaveLength(1);
    expect(store.active.id).toBe(2);
    expect(store.draft).toMatchObject({ basedOn: 2, changes: [] });
    await expect(store.publish('empty')).rejects.toThrow('no changes');
  });

  it('rolls back to an earlier version and can start a draft from it', async () => {
    const store = await open();
    await store.saveDraft(edit((c) => (c.costs.ritual.grain = 3)), 'x');
    await store.publish('v2');
    await store.activate(1);
    expect(store.active.config.costs.ritual.grain).toBe(4);
    expect(store.versions).toHaveLength(2);
    await store.resetDraft(1);
    expect(store.draft).toMatchObject({ basedOn: 1, changes: [] });
    await expect(store.activate(9)).rejects.toBeInstanceOf(ConfigError);
  });

  it('reloads from persistence', async () => {
    const persistence = memoryPersistence();
    const first = await ConfigStore.open(persistence, '0.3.0');
    await first.saveDraft(edit((c) => (c.shop.slots = 5)), 'x');
    await first.publish('v2');
    const second = await ConfigStore.open(persistence, '0.4.0');
    expect(second.active.id).toBe(2);
    expect(second.versions[1]!.build).toBe('0.3.0');
  });
});

describe('diffConfig', () => {
  it('lists changed leaves with their paths', () => {
    expect(diffConfig({ a: { b: 1, c: [1, 2] } }, { a: { b: 2, c: [1, 3] } })).toEqual(['a.b: 1 → 2', 'a.c.1: 2 → 3']);
  });
});

describe('AdminAuth', () => {
  it('issues sessions only for the right password', () => {
    const auth = new AdminAuth('family');
    expect(auth.login('wrong')).toBeNull();
    const token = auth.login('family')!;
    expect(auth.isAdmin(`Bearer ${token}`)).toBe(true);
    expect(auth.isAdmin('Bearer nope')).toBe(false);
    expect(auth.isAdmin(undefined)).toBe(false);
  });

  it('disables admin when no password is configured', () => {
    expect(new AdminAuth('').login('')).toBeNull();
  });

  it('tracks draft tokens', () => {
    const auth = new AdminAuth('x');
    const t = auth.issueDraftToken();
    expect(auth.isDraftToken(t)).toBe(true);
    expect(auth.isDraftToken('other')).toBe(false);
  });
});
