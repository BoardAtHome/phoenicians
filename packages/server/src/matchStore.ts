import type { LogEntry, Server, State, StorageAPI } from 'boardgame.io';
import { Async } from 'boardgame.io/internal';

interface MemoryMatch {
  state?: State;
  initialState?: State;
  metadata: Server.MatchData;
  log: LogEntry[];
}

/** Match storage that lives in memory, for development and tests. */
export class MemoryMatchStore extends Async {
  private matches = new Map<string, MemoryMatch>();

  async connect() {}

  async createMatch(matchID: string, { initialState, metadata }: StorageAPI.CreateMatchOpts) {
    this.matches.set(matchID, { state: initialState, initialState, metadata, log: [] });
  }

  async setState(matchID: string, state: State, deltalog?: LogEntry[]) {
    const match = this.matches.get(matchID);
    if (!match) return;
    match.state = state;
    match.log.push(...(deltalog ?? []));
  }

  async setMetadata(matchID: string, metadata: Server.MatchData) {
    const match = this.matches.get(matchID);
    if (match) match.metadata = metadata;
  }

  async fetch<O extends StorageAPI.FetchOpts>(matchID: string, opts: O): Promise<StorageAPI.FetchResult<O>> {
    const match = this.matches.get(matchID);
    const result: Partial<StorageAPI.FetchFields> = {};
    if (match) {
      if (opts.state) result.state = match.state;
      if (opts.initialState) result.initialState = match.initialState;
      if (opts.metadata) result.metadata = match.metadata;
      if (opts.log) result.log = match.log;
    }
    return structuredClone(result) as StorageAPI.FetchResult<O>;
  }

  async wipe(matchID: string) {
    this.matches.delete(matchID);
  }

  async listMatches(opts?: StorageAPI.ListMatchesOpts): Promise<string[]> {
    return [...this.matches.entries()]
      .filter(([, m]) => {
        if (opts?.gameName && m.metadata.gameName !== opts.gameName) return false;
        const where = opts?.where;
        if (where?.isGameover !== undefined && (m.metadata.gameover !== undefined) !== where.isGameover) return false;
        if (where?.updatedBefore !== undefined && m.metadata.updatedAt >= where.updatedBefore) return false;
        if (where?.updatedAfter !== undefined && m.metadata.updatedAt <= where.updatedAfter) return false;
        return true;
      })
      .map(([id]) => id);
  }
}

/**
 * Wraps a match store and remembers the last few states of each match, so the
 * admin can undo actions. The history is kept in memory: it starts empty after
 * a server restart.
 */
export class HistoryStore extends Async {
  private history = new Map<string, State[]>();

  constructor(readonly inner: StorageAPI.Async, private depth = 30) {
    super();
  }

  connect() {
    return this.inner.connect();
  }

  async createMatch(matchID: string, opts: StorageAPI.CreateMatchOpts) {
    this.history.set(matchID, [opts.initialState]);
    return this.inner.createMatch(matchID, opts);
  }

  async setState(matchID: string, state: State, deltalog?: LogEntry[]) {
    const list = this.history.get(matchID) ?? [];
    list.push(structuredClone(state));
    if (list.length > this.depth) list.shift();
    this.history.set(matchID, list);
    return this.inner.setState(matchID, state, deltalog);
  }

  setMetadata(matchID: string, metadata: Server.MatchData) {
    return this.inner.setMetadata(matchID, metadata);
  }

  fetch<O extends StorageAPI.FetchOpts>(matchID: string, opts: O) {
    return this.inner.fetch(matchID, opts);
  }

  async wipe(matchID: string) {
    this.history.delete(matchID);
    return this.inner.wipe(matchID);
  }

  listMatches(opts?: StorageAPI.ListMatchesOpts) {
    return this.inner.listMatches(opts);
  }

  /** How many earlier states can be restored. */
  undoDepth(matchID: string): number {
    return Math.max(0, (this.history.get(matchID)?.length ?? 0) - 1);
  }

  /** Drops the latest state and returns the one before it, or null if there is none. */
  popState(matchID: string): State | null {
    const list = this.history.get(matchID);
    if (!list || list.length < 2) return null;
    list.pop();
    return structuredClone(list[list.length - 1]!);
  }
}
