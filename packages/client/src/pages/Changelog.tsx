import { useEffect, useState } from 'react';
import { api, type ChangeEntry, type VersionSummary } from '../api';

export function ChangeList({ changes }: { changes: ChangeEntry[] }) {
  return (
    <ul className="changes">
      {changes.map((c) => (
        <li key={c.at}>
          <div>{c.note} <span className="muted small">· {new Date(c.at).toLocaleString()}</span></div>
          <ul className="muted small">
            {c.changes.map((line) => <li key={line}><code>{line}</code></li>)}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function Changelog() {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [build, setBuild] = useState('');
  useEffect(() => {
    api.versions().then((v) => { setVersions(v.versions); setBuild(v.build); }).catch(() => setVersions([]));
  }, []);

  return (
    <section className="panel narrow stack">
      <h1>Changelog</h1>
      <p className="muted small">Rule and balance changes, newest first. App build {build}.</p>
      {versions?.map((v) => (
        <article key={v.id} className="version">
          <div className="row spread">
            <h3>v{v.id}{v.active && ' · in use'}</h3>
            <span className="muted small">{new Date(v.createdAt).toLocaleDateString()}</span>
          </div>
          <p>{v.note}</p>
          {v.changes.length > 0 && <ChangeList changes={v.changes} />}
        </article>
      ))}
    </section>
  );
}
