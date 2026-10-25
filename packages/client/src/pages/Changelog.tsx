import { useEffect, useState } from 'react';
import changelogText from '../../../../CHANGELOG.md?raw';
import { api, type ChangeEntry, type VersionSummary } from '../api';
import { codeSpans, parseChangelog } from '../changelog';

const BUILDS = parseChangelog(changelogText);

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

type Tab = 'builds' | 'rules';

export function Changelog() {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [build, setBuild] = useState('');
  const [tab, setTab] = useState<Tab>(window.location.hash === '#rules' ? 'rules' : 'builds');
  useEffect(() => {
    api.versions().then((v) => { setVersions(v.versions); setBuild(v.build); }).catch(() => setVersions([]));
  }, []);

  const pick = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, '', t === 'rules' ? '#rules' : window.location.pathname);
  };

  return (
    <section className="panel narrow stack">
      <h1>What's new</h1>
      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'builds'} className={tab === 'builds' ? 'active' : ''} onClick={() => pick('builds')}>
          App builds
        </button>
        <button role="tab" aria-selected={tab === 'rules'} className={tab === 'rules' ? 'active' : ''} onClick={() => pick('rules')}>
          Rules and balance
        </button>
      </nav>

      {tab === 'builds' && (
        <>
          <p className="muted small">What each new version of the app added, newest first.{build && <> You are on build {build}.</>}</p>
          {BUILDS.map((b) => (
            <article key={b.version} className="version">
              <div className="row spread">
                <h3>{b.version} · {b.title}{b.version === build && ' · in use'}</h3>
                {b.meta && <span className="muted small">{b.meta}</span>}
              </div>
              <ul className="changes">
                {b.items.map((item) => (
                  <li key={item}>{codeSpans(item).map((p, i) => (p.code ? <code key={i}>{p.text}</code> : p.text))}</li>
                ))}
              </ul>
            </article>
          ))}
        </>
      )}

      {tab === 'rules' && (
        <>
          <p className="muted small">Rule and balance changes made on the admin page (config versions), newest first.</p>
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
        </>
      )}
    </section>
  );
}
