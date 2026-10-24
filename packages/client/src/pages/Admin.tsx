import { useEffect, useState } from 'react';
import { diffConfig, validateConfig, type GameConfig } from '@phoenicians/engine';
import { ApiError, api, getAdminToken, setAdminToken, type Draft, type VersionSummary } from '../api';
import { ConfigForm } from './admin/ConfigForm';
import { Matches } from './admin/Matches';
import { Versions } from './admin/Versions';
import { ChangeList } from './Changelog';

export function Admin() {
  const [loggedIn, setLoggedIn] = useState(!!getAdminToken());
  return loggedIn ? <AdminPanel onLogout={() => setLoggedIn(false)} /> : <Login onLogin={() => setLoggedIn(true)} />;
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  return (
    <section className="panel narrow">
      <h1>Admin</h1>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.login(password);
            onLogin();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
          }
        }}
      >
        <input type="password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        {error && <p className="error">{error}</p>}
        <button className="primary">Unlock</button>
      </form>
    </section>
  );
}

type Tab = 'config' | 'versions' | 'matches';
const TABS: { id: Tab; label: string }[] = [
  { id: 'config', label: 'Config' },
  { id: 'versions', label: 'Versions' },
  { id: 'matches', label: 'Matches and stats' },
];
const tabFromHash = (): Tab => {
  const hash = window.location.hash.slice(1);
  return TABS.some((t) => t.id === hash) ? (hash as Tab) : 'config';
};

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTabState] = useState<Tab>(tabFromHash);
  const setTab = (next: Tab) => {
    setTabState(next);
    setMessage('');
    window.history.replaceState(null, '', `#${next}`);
  };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [working, setWorking] = useState<GameConfig | null>(null);
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [publishNote, setPublishNote] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  async function refresh(resetEdits = true) {
    try {
      const [d, v] = await Promise.all([api.draft(), api.versions()]);
      setDraft(d);
      setVersions(v.versions);
      if (resetEdits) {
        setWorking(structuredClone(d.config));
        setText(JSON.stringify(d.config, null, 2));
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onLogout();
      else setErrors([err instanceof Error ? err.message : 'Could not load']);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function run(action: () => Promise<unknown>, success: string, resetEdits = true) {
    setErrors([]);
    setMessage('');
    try {
      await action();
      setMessage(success);
      await refresh(resetEdits);
    } catch (err) {
      if (err instanceof ApiError) setErrors([err.message, ...err.details]);
      else setErrors([err instanceof Error ? err.message : 'Something went wrong']);
    }
  }

  /** The config being edited, read from the JSON box when that is showing. */
  function current(): GameConfig | null {
    if (mode === 'form') return working;
    try {
      return JSON.parse(text) as GameConfig;
    } catch (err) {
      setErrors([`The JSON is not valid: ${(err as Error).message}`]);
      return null;
    }
  }

  function switchMode(next: 'form' | 'json') {
    if (next === mode) return;
    if (next === 'json') setText(JSON.stringify(working, null, 2));
    else {
      const parsed = current();
      if (!parsed) return;
      setWorking(parsed);
    }
    setErrors([]);
    setMode(next);
  }

  async function save() {
    const config = current();
    if (!config) return;
    await run(async () => {
      const { saved } = await api.saveDraft(config, note);
      if (!saved) throw new ApiError('Nothing changed');
      setNote('');
    }, 'Change saved to the draft.');
  }

  const update = (change: (c: GameConfig) => void) =>
    setWorking((prev) => {
      const next = structuredClone(prev!);
      change(next);
      return next;
    });

  if (!draft || !working) return <section className="panel"><p className="muted">Loading…</p>{errors.map((e) => <p key={e} className="error">{e}</p>)}</section>;
  const active = versions.find((v) => v.active);
  const pending = mode === 'form' ? diffConfig(draft.config, working) : null;
  const problems = mode === 'form' ? validateConfig(working) : [];

  return (
    <div className="stack">
      <div className="row spread">
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <button className="ghost" onClick={() => { setAdminToken(null); onLogout(); }}>Log out</button>
      </div>
      {message && <p className="success">{message}</p>}
      {errors.length > 0 && <ul className="error">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}

      {tab === 'config' && (
        <div className="admin columns">
          <section className="panel stack">
            <div className="row spread">
              <h2>Draft config</h2>
              <div className="tabs small">
                <button className={mode === 'form' ? 'active' : ''} onClick={() => switchMode('form')}>Form</button>
                <button className={mode === 'json' ? 'active' : ''} onClick={() => switchMode('json')}>JSON</button>
              </div>
            </div>
            <p className="muted small">
              Based on v{draft.basedOn}. New games use v{active?.id} until you publish. Edit, describe the change, and save. Changes pile up until you publish them as a version.
            </p>
            {mode === 'form' ? (
              <ConfigForm config={working} update={update} />
            ) : (
              <textarea className="code" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} rows={28} />
            )}
            <div className="save-bar stack">
              {pending && pending.length > 0 && (
                <details>
                  <summary className="small">{pending.length} unsaved edit{pending.length === 1 ? '' : 's'}</summary>
                  <ul className="diff">{pending.map((line) => <li key={line}><code>{line}</code></li>)}</ul>
                </details>
              )}
              {problems.length > 0 && <ul className="error small">{problems.map((e) => <li key={e}>{e}</li>)}</ul>}
              <div className="row">
                <input placeholder="What changed and why" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="primary" disabled={problems.length > 0 || pending?.length === 0} onClick={save}>Save change</button>
                <button
                  className="ghost"
                  onClick={() => {
                    setWorking(structuredClone(draft.config));
                    setText(JSON.stringify(draft.config, null, 2));
                  }}
                >
                  Undo edits
                </button>
              </div>
            </div>
          </section>

          <section className="panel stack">
            <h2>Unpublished changes ({draft.changes.length})</h2>
            {draft.changes.length === 0 ? <p className="muted small">None yet.</p> : <ChangeList changes={draft.changes} />}
            <div className="row">
              <input placeholder={`Release note for v${Math.max(0, ...versions.map((v) => v.id)) + 1}`} value={publishNote} onChange={(e) => setPublishNote(e.target.value)} />
              <button
                className="primary"
                disabled={draft.changes.length === 0}
                onClick={() => run(async () => { await api.publish(publishNote); setPublishNote(''); }, 'Published. New games now use this version.')}
              >
                Publish
              </button>
            </div>
            <p className="muted small">To try the draft first, start a new game from the home page and tick "Test the unpublished draft config".</p>
          </section>
        </div>
      )}
      {tab === 'versions' && <Versions versions={versions} draft={draft} run={run} />}
      {tab === 'matches' && <Matches />}
    </div>
  );
}
