import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChangelog } from '../src/changelog';

const root = path.resolve(import.meta.dirname, '../../..');
const builds = parseChangelog(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'));
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };

describe('CHANGELOG.md', () => {
  it('has an entry for the current build, at the top', () => {
    expect(builds[0]?.version).toBe(version);
  });

  it('lists builds newest first, each with a date and at least one change', () => {
    const key = (v: string) => v.split('.').map(Number).reduce((a, n) => a * 1000 + n, 0);
    for (let i = 1; i < builds.length; i++) expect(key(builds[i - 1]!.version)).toBeGreaterThan(key(builds[i]!.version));
    for (const b of builds) {
      expect(b.meta, b.version).not.toBe('');
      expect(b.items.length, b.version).toBeGreaterThan(0);
    }
  });

  it('joins wrapped bullet lines', () => {
    const [b] = parseChangelog('## 1.2.3 — Title\n\n_1 Jan · PR #1_\n\n- First line\n  continued.\n- Second\n');
    expect(b).toEqual({ version: '1.2.3', title: 'Title', meta: '1 Jan · PR #1', items: ['First line continued.', 'Second'] });
  });
});
