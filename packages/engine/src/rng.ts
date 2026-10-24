/**
 * Randomness is injected so the same engine runs under boardgame.io's seeded
 * `random` API on the server and under a seeded generator in tests.
 */
export interface Rng {
  /** Returns a float in [0, 1). */
  next(): number;
}

/** Small seeded generator (mulberry32). Deterministic for a given seed. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Fisher–Yates shuffle in place; returns the same array. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
