import pg from 'pg';
import type { Persistence, StoreData } from './configStore';

/** Keeps the whole config store as one JSON row. Small, and plenty for a playtest group. */
export async function postgresPersistence(connectionString: string): Promise<Persistence> {
  const pool = new pg.Pool({ connectionString, ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false } });
  await pool.query('CREATE TABLE IF NOT EXISTS phoenicians_store (id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  return {
    async load() {
      const result = await pool.query<{ data: StoreData }>('SELECT data FROM phoenicians_store WHERE id = 1');
      return result.rows[0]?.data ?? null;
    },
    async save(data) {
      await pool.query(
        'INSERT INTO phoenicians_store (id, data, updated_at) VALUES (1, $1, now()) ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()',
        [JSON.stringify(data)],
      );
    },
  };
}
