import type { LogEntry, Server, State, StorageAPI } from 'boardgame.io';
import { Async } from 'boardgame.io/internal';
import pg from 'pg';
import type { Persistence, StoreData } from './configStore';

export function createPool(connectionString: string): pg.Pool {
  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  return new pg.Pool({ connectionString, ssl: local ? false : { rejectUnauthorized: false } });
}

/** Keeps the whole config store as one JSON row. Small, and plenty for a playtest group. */
export async function postgresPersistence(pool: pg.Pool): Promise<Persistence> {
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

interface MatchRow {
  state: State;
  initial_state: State;
  metadata: Server.MatchData;
  log: LogEntry[];
}

/** boardgame.io match storage in Postgres, so games survive server restarts and sleep. */
export class PostgresMatchStore extends Async {
  constructor(private pool: pg.Pool) {
    super();
  }

  async connect() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS phoenicians_matches (
      match_id TEXT PRIMARY KEY,
      game_name TEXT NOT NULL,
      state JSONB,
      initial_state JSONB,
      metadata JSONB NOT NULL,
      log JSONB NOT NULL DEFAULT '[]',
      gameover BOOLEAN NOT NULL DEFAULT false,
      updated_at BIGINT NOT NULL
    )`);
  }

  async createMatch(matchID: string, { initialState, metadata }: StorageAPI.CreateMatchOpts) {
    await this.pool.query(
      `INSERT INTO phoenicians_matches (match_id, game_name, state, initial_state, metadata, updated_at)
       VALUES ($1, $2, $3, $3, $4, $5)`,
      [matchID, metadata.gameName, JSON.stringify(initialState), JSON.stringify(metadata), metadata.updatedAt],
    );
  }

  async setState(matchID: string, state: State, deltalog?: LogEntry[]) {
    await this.pool.query(
      'UPDATE phoenicians_matches SET state = $2, log = log || $3::jsonb, updated_at = $4 WHERE match_id = $1',
      [matchID, JSON.stringify(state), JSON.stringify(deltalog ?? []), Date.now()],
    );
  }

  async setMetadata(matchID: string, metadata: Server.MatchData) {
    await this.pool.query(
      'UPDATE phoenicians_matches SET metadata = $2, gameover = $3, updated_at = $4 WHERE match_id = $1',
      [matchID, JSON.stringify(metadata), metadata.gameover !== undefined, metadata.updatedAt],
    );
  }

  async fetch<O extends StorageAPI.FetchOpts>(matchID: string, opts: O): Promise<StorageAPI.FetchResult<O>> {
    // Only the columns asked for: most fetches (every move, lobby polls) want just the metadata or the state.
    const columns = (['state', 'initial_state', 'metadata', 'log'] as const).filter(
      (c) => opts[c === 'initial_state' ? 'initialState' : c],
    );
    const result: Partial<StorageAPI.FetchFields> = {};
    if (columns.length === 0) return result as StorageAPI.FetchResult<O>;
    const { rows } = await this.pool.query<MatchRow>(`SELECT ${columns.join(', ')} FROM phoenicians_matches WHERE match_id = $1`, [matchID]);
    const row = rows[0];
    if (!row) return result as StorageAPI.FetchResult<O>;
    if (opts.state) result.state = row.state;
    if (opts.initialState) result.initialState = row.initial_state;
    if (opts.metadata) result.metadata = row.metadata;
    if (opts.log) result.log = row.log;
    return result as StorageAPI.FetchResult<O>;
  }

  async wipe(matchID: string) {
    await this.pool.query('DELETE FROM phoenicians_matches WHERE match_id = $1', [matchID]);
  }

  async listMatches(opts?: StorageAPI.ListMatchesOpts): Promise<string[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where.push(clause.replace('?', `$${params.length}`));
    };
    if (opts?.gameName) add('game_name = ?', opts.gameName);
    if (opts?.where?.isGameover !== undefined) add('gameover = ?', opts.where.isGameover);
    if (opts?.where?.updatedBefore !== undefined) add('updated_at < ?', opts.where.updatedBefore);
    if (opts?.where?.updatedAfter !== undefined) add('updated_at > ?', opts.where.updatedAfter);
    const { rows } = await this.pool.query<{ match_id: string }>(
      `SELECT match_id FROM phoenicians_matches ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
      params,
    );
    return rows.map((r) => r.match_id);
  }
}
