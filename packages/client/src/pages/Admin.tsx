import { useEffect, useState } from 'react';
import { ApiError, api, getAdminToken, setAdminToken, type Draft, type VersionSummary } from '../api';
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

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [publishNote, setPublishNote] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  async function refresh(resetText = true) {
    try {
      const [d, v] = await Promise.all([api.draft(), api.versions()]);
      setDraft(d);
      setVersions(v.versions);
      if (resetText) setText(JSON.stringify(d.config, null, 2));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onLogout();
      else setErrors([err instanceof Error ? err.message : 'Could not load']);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function run(action: () => Promise<unknown>, success: string, resetText = true) {
    setErrors([]);
    setMessage('');
    try {
      await action();
      setMessage(success);
      await refresh(resetText);
    } catch (err) {
      if (err instanceof ApiError) setErrors([err.message, ...err.details]);
      else setErrors([err instanceof Error ? err.message : 'Something went wrong']);
    }
  }

  async function save() {
    let config;
    try {
      config = JSON.parse(text);
    } catch (err) {
      setErrors([`The JSON is not valid: ${(err as Error).message}`]);
      return;
    }
    await run(async () => {
      const { saved } = await api.saveDraft(config, note);
      if (!saved) throw new ApiError('Nothing changed');
      setNote('');
    }, 'Change saved to the draft.');
  }

  if (!draft) return <section className="panel"><p className="muted">Loading…</p>{errors.map((e) => <p key={e} className="error">{e}</p>)}</section>;
  const active = versions.find((v) => v.active);

  return (
    <div className="admin columns">
      <section className="panel stack">
        <div className="row spread">
          <h2>Draft config</h2>
          <button className="ghost" onClick={() => { setAdminToken(null); onLogout(); }}>Log out</button>
        </div>
        <p className="muted small">
          Based on v{draft.basedOn}. New games use v{active?.id} until you publish. Edit the JSON, describe the change, and save. Changes pile up until you publish them as a version.
        </p>
        <textarea className="code" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} rows={28} />
        <div className="row">
          <input placeholder="What changed and why" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="primary" onClick={save}>Save change</button>
          <button className="ghost" onClick={() => setText(JSON.stringify(draft.config, null, 2))}>Undo edits</button>
        </div>
        {message && <p className="success">{message}</p>}
        {errors.length > 0 && <ul className="error">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      </section>

      <div className="stack">
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

        <section className="panel stack">
          <h2>Versions</h2>
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
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
