import type { GameConfig, GameState, GameStats } from '@phoenicians/engine';
import { LobbyClient } from 'boardgame.io/client';

export const SERVER = window.location.origin;
export const lobby = new LobbyClient({ server: SERVER });

const ADMIN_KEY = 'phoenicians.adminToken';
const seatKey = (matchID: string) => `phoenicians.seat.${matchID}`;

const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* storage unavailable: the seat or session lasts for this page only */
    }
  },
};

export interface Seat {
  playerID: string;
  credentials: string;
}

export const getSeat = (matchID: string): Seat | null => {
  const raw = storage.get(seatKey(matchID));
  return raw ? (JSON.parse(raw) as Seat) : null;
};
export const saveSeat = (matchID: string, seat: Seat | null) => storage.set(seatKey(matchID), seat && JSON.stringify(seat));

export const getAdminToken = () => storage.get(ADMIN_KEY);
export const setAdminToken = (token: string | null) => storage.set(ADMIN_KEY, token);

export class ApiError extends Error {
  constructor(message: string, readonly details: string[] = [], readonly status = 0) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown, admin = false): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = getAdminToken();
  if (admin && token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string; details?: string[] };
  if (!res.ok) {
    if (res.status === 401 && admin) setAdminToken(null);
    throw new ApiError(data.error ?? `Request failed (${res.status})`, data.details, res.status);
  }
  return data as T;
}

export interface ChangeEntry {
  at: string;
  note: string;
  changes: string[];
}
export interface VersionSummary {
  id: number;
  note: string;
  createdAt: string;
  build: string;
  changes: ChangeEntry[];
  active: boolean;
}
export interface Draft {
  basedOn: number;
  config: GameConfig;
  changes: ChangeEntry[];
}

export interface MatchSummary {
  matchID: string;
  createdAt: number;
  updatedAt: number;
  players: { name: string; eliminated: boolean; connected: boolean }[];
  turn: number;
  phase: string;
  activePlayer?: string;
  winner: string | null;
  configVersion: string;
  build: string;
  undoDepth: number;
}
export interface MatchDetail {
  summary: MatchSummary;
  stats: GameStats;
  G: GameState;
}

/** Fetches an admin-only file and hands it to the browser as a download. */
async function download(url: string, filename: string) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${getAdminToken() ?? ''}` } });
  if (!res.ok) throw new ApiError(`Download failed (${res.status})`, [], res.status);
  const href = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const api = {
  config: () => request<{ version: number; build: string; config: GameConfig }>('GET', '/api/config'),
  versions: () => request<{ build: string; versions: VersionSummary[] }>('GET', '/api/versions'),
  login: async (password: string) => {
    const { token } = await request<{ token: string }>('POST', '/api/admin/login', { password });
    setAdminToken(token);
  },
  draft: () => request<Draft>('GET', '/api/admin/draft', undefined, true),
  saveDraft: (config: GameConfig, note: string) =>
    request<{ saved: ChangeEntry | null; draft: Draft }>('PUT', '/api/admin/draft', { config, note }, true),
  resetDraft: (versionId: number) => request<{ draft: Draft }>('POST', '/api/admin/draft/reset', { versionId }, true),
  publish: (note: string) => request<VersionSummary>('POST', '/api/admin/publish', { note }, true),
  activate: (versionId: number) => request<{ active: number }>('POST', '/api/admin/activate', { versionId }, true),
  draftToken: () => request<{ token: string }>('POST', '/api/admin/draft-token', {}, true),
  versionConfig: (id: number) => request<VersionSummary & { config: GameConfig }>('GET', `/api/versions/${id}`),
  matches: () => request<{ matches: MatchSummary[] }>('GET', '/api/admin/matches', undefined, true),
  match: (id: string) => request<MatchDetail>('GET', `/api/admin/matches/${id}`, undefined, true),
  endMatch: (id: string) => request<{ summary: MatchSummary }>('POST', `/api/admin/matches/${id}/end`, {}, true),
  undoMatch: (id: string) => request<{ summary: MatchSummary }>('POST', `/api/admin/matches/${id}/undo`, {}, true),
  downloadLog: (id: string) => download(`/api/admin/matches/${id}/log.csv`, `phoenicians-${id}-log.csv`),
  downloadJson: (id: string) => download(`/api/admin/matches/${id}/export.json`, `phoenicians-${id}.json`),
  downloadSummary: () => download('/api/admin/stats.csv', 'phoenicians-games.csv'),
};
