import { useEffect, useState } from 'react';
import { diffConfig, type GameConfig } from '@phoenicians/engine';
import { api, type Draft, type VersionSummary } from '../../api';
import { ChangeList } from '../Changelog';

const DRAFT = 'draft';

/** Every version with its notes, plus a side-by-side comparison of any two versions or the draft. */
export function Versions({
  versions,
  draft,
  run,
}: {
  versions: VersionSummary[];
  draft: Draft;
  run: (action: () => Promise<unknown>, success: string, resetText?: boolean) => Promise<void>;
}) {
  const latest = versions[0]?.id ?? 1;
  const [from, setFrom] = useState(String(Math.max(1, latest - 1)));
  const [to, setTo] = useState(String(latest));
  const [diff, setDiff] = useState<string[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    const load = (key: string): Promise<GameConfig> => (key === DRAFT ? Promise.resolve(draft.config) : api.versionConfig(Number(key)).then((v) => v.config));
    setDiff(null);
    Promise.all([load(from), load(to)])
      .then(([a, b]) => live && setDiff(diffConfig(a, b)))
      .catch(() => live && setDiff([]));
    return () => {
      live = false;
    };
  }, [from, to, draft]);

  const options = [
    ...versions.map((v) => <option key={v.id} value={v.id}>v{v.id}{v.active ? ' (active)' : ''}</option>),
    <option key={DRAFT} value={DRAFT}>Draft</option>,
  ];
  const label = (key: string) => (key === DRAFT ? 'the draft' : `v${key}`);

  return (
    <div className="stack">
      <section className="panel stack">
        <h2>Compare</h2>
        <div className="row">
          <select aria-label="Compare from" value={from} onChange={(e) => setFrom(e.target.value)}>{options}</select>
          <span>to</span>
          <select aria-label="Compare to" value={to} onChange={(e) => setTo(e.target.value)}>{options}</select>
        </div>
        {diff === null ? (
          <p className="muted small">Loading…</p>
        ) : diff.length === 0 ? (
          <p className="muted small">{label(from)} and {label(to)} are the same.</p>
        ) : (
          <>
            <p className="small">{diff.length} difference{diff.length === 1 ? '' : 's'} from {label(from)} to {label(to)}:</p>
            <ul className="diff">{diff.map((line) => <li key={line}><code>{line}</code></li>)}</ul>
          </>
        )}
      </section>

      <section className="panel stack">
        <h2>History</h2>
        {versions.map((v) => (
          <div key={v.id} className="version">
            <div className="row spread">
              <strong>v{v.id}{v.active && ' · active'}</strong>
              <span className="muted small">{new Date(v.createdAt).toLocaleString()} · build {v.build}</span>
            </div>
            <div className="small">{v.note}</div>
            <div className="row">
              <button disabled={v.active} onClick={() => run(() => api.activate(v.id), `v${v.id} is now active.`, false)}>Make active</button>
              <button
                className="ghost"
                onClick={() => {
                  if (draft.changes.length === 0 || window.confirm('This discards the unpublished changes. Continue?')) {
                    void run(() => api.resetDraft(v.id), `The draft now starts from v${v.id}.`);
                  }
                }}
              >
                Start draft from v{v.id}
              </button>
              {v.changes.length > 0 && (
                <button className="ghost" onClick={() => setOpen(open === v.id ? null : v.id)}>
                  {open === v.id ? 'Hide' : 'Show'} {v.changes.length} change{v.changes.length === 1 ? '' : 's'}
                </button>
              )}
              {v.id > 1 && (
                <button className="ghost" onClick={() => { setFrom(String(v.id - 1)); setTo(String(v.id)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  Compare with v{v.id - 1}
                </button>
              )}
            </div>
            {open === v.id && <ChangeList changes={v.changes} />}
          </div>
        ))}
      </section>
    </div>
  );
}
