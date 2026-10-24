import { afterAll, describe, expect, it } from 'vitest';
import { ConfigStore } from '../src/configStore';
import { createPool, PostgresMatchStore, postgresPersistence } from '../src/postgres';

// Runs only when a database is available: TEST_DATABASE_URL=postgres://... npm test
const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)('Postgres storage', () => {
  const pool = createPool(url!);
  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS phoenicians_store, phoenicians_matches');
    await pool.end();
  });

  it('persists the config store across reopen', async () => {
    await pool.query('DROP TABLE IF EXISTS phoenicians_store');
    const first = await ConfigStore.open(await postgresPersistence(pool), '0.3.0');
    const config = structuredClone(first.draft.config);
    config.shop.slots = 5;
    await first.saveDraft(config, 'smaller shop');
    await first.publish('v2');
    const second = await ConfigStore.open(await postgresPersistence(pool), '0.3.0');
    expect(second.active.id).toBe(2);
    expect(second.active.config.shop.slots).toBe(5);
  });

  it('stores, updates, lists and wipes matches', async () => {
    const db = new PostgresMatchStore(pool);
    await db.connect();
    const metadata = { gameName: 'phoenicians', players: {}, createdAt: 1, updatedAt: 1 };
    const state = { G: { n: 1 }, _stateID: 0 } as never;
    await db.createMatch('m1', { initialState: state, metadata });
    await db.setState('m1', { G: { n: 2 }, _stateID: 1 } as never, [{ action: { type: 'MAKE_MOVE' } } as never]);
    await db.setState('m1', { G: { n: 3 }, _stateID: 2 } as never, [{ action: { type: 'MAKE_MOVE' } } as never]);
    const fetched = await db.fetch('m1', { state: true, initialState: true, metadata: true, log: true });
    expect(fetched.state).toMatchObject({ G: { n: 3 } });
    expect(fetched.initialState).toMatchObject({ G: { n: 1 } });
    expect(fetched.log).toHaveLength(2);
    await db.setMetadata('m1', { ...metadata, gameover: { winner: '0' }, updatedAt: 5 });
    expect(await db.listMatches({ gameName: 'phoenicians', where: { isGameover: true } })).toEqual(['m1']);
    expect(await db.listMatches({ where: { isGameover: false } })).toEqual([]);
    await db.wipe('m1');
    expect(await db.fetch('m1', { state: true })).toEqual({});
  });
});
