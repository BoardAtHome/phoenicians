import { baselineConfig, diffConfig, validateConfig, type GameConfig } from '@phoenicians/engine';

export { diffConfig };

/** One saved edit in the draft. */
export interface ChangeEntry {
  at: string;
  note: string;
  /** JSON paths that changed, e.g. `costs.attack.warriors: 3 → 4`. */
  changes: string[];
}

export interface ConfigVersion {
  id: number;
  note: string;
  createdAt: string;
  /** App build the version was published on. */
  build: string;
  config: GameConfig;
  changes: ChangeEntry[];
}

export interface StoreData {
  versions: ConfigVersion[];
  activeVersionId: number;
  draft: { basedOn: number; config: GameConfig; changes: ChangeEntry[] };
}

/** Where store data is kept between restarts. */
export interface Persistence {
  load(): Promise<StoreData | null>;
  save(data: StoreData): Promise<void>;
}

export const memoryPersistence = (): Persistence => {
  let data: StoreData | null = null;
  return {
    load: async () => (data ? structuredClone(data) : null),
    save: async (next) => {
      data = structuredClone(next);
    },
  };
};

export class ConfigError extends Error {
  constructor(message: string, readonly details: string[] = []) {
    super(message);
  }
}

/**
 * Config versions. Edits pile up in a draft with notes; publishing bundles them
 * into the next version. Any version can be made active again (rollback) or used
 * as the base of a new draft. Versions are never deleted.
 */
export class ConfigStore {
  private constructor(private data: StoreData, private persistence: Persistence, private build: string) {}

  static async open(persistence: Persistence, build: string, initial: GameConfig = baselineConfig): Promise<ConfigStore> {
    const existing = await persistence.load();
    if (existing) return new ConfigStore(existing, persistence, build);
    const now = new Date().toISOString();
    const data: StoreData = {
      versions: [{ id: 1, note: 'Baseline from the rulebook and the 24 October 2026 decisions', createdAt: now, build, config: initial, changes: [] }],
      activeVersionId: 1,
      draft: { basedOn: 1, config: structuredClone(initial), changes: [] },
    };
    await persistence.save(data);
    return new ConfigStore(data, persistence, build);
  }

  get active(): ConfigVersion {
    return this.version(this.data.activeVersionId)!;
  }

  get draft(): StoreData['draft'] {
    return this.data.draft;
  }

  get versions(): ConfigVersion[] {
    return this.data.versions;
  }

  version(id: number): ConfigVersion | undefined {
    return this.data.versions.find((v) => v.id === id);
  }

  /** Saves a new draft config. Rejects invalid configs; a save with no changes is a no-op. */
  async saveDraft(config: GameConfig, note: string): Promise<ChangeEntry | null> {
    const errors = validateConfig(config);
    if (errors.length) throw new ConfigError('The config is not valid', errors);
    const changes = diffConfig(this.data.draft.config, config);
    if (changes.length === 0) return null;
    const entry: ChangeEntry = { at: new Date().toISOString(), note: note.trim() || '(no note)', changes };
    this.data.draft = { ...this.data.draft, config: structuredClone(config), changes: [...this.data.draft.changes, entry] };
    await this.persist();
    return entry;
  }

  /** Bundles the draft into a new version and makes it active. */
  async publish(note: string): Promise<ConfigVersion> {
    if (this.data.draft.changes.length === 0) throw new ConfigError('The draft has no changes to publish');
    const version: ConfigVersion = {
      id: Math.max(...this.data.versions.map((v) => v.id)) + 1,
      note: note.trim() || '(no note)',
      createdAt: new Date().toISOString(),
      build: this.build,
      config: structuredClone(this.data.draft.config),
      changes: this.data.draft.changes,
    };
    this.data.versions.push(version);
    this.data.activeVersionId = version.id;
    this.data.draft = { basedOn: version.id, config: structuredClone(version.config), changes: [] };
    await this.persist();
    return version;
  }

  /** Makes an earlier (or later) version the one new matches use. */
  async activate(versionId: number): Promise<void> {
    if (!this.version(versionId)) throw new ConfigError(`Version ${versionId} does not exist`);
    this.data.activeVersionId = versionId;
    await this.persist();
  }

  /** Throws away the draft's changes and starts a new draft from a version. */
  async resetDraft(versionId: number): Promise<void> {
    const version = this.version(versionId);
    if (!version) throw new ConfigError(`Version ${versionId} does not exist`);
    this.data.draft = { basedOn: versionId, config: structuredClone(version.config), changes: [] };
    await this.persist();
  }

  private persist(): Promise<void> {
    return this.persistence.save(this.data);
  }
}
