import { useState } from 'react';
import type { SetupData } from '@phoenicians/game';
import { navigate } from '../App';
import { api, getAdminToken, lobby } from '../api';

export function Home() {
  const [names, setNames] = useState(['', '', '']);
  const [first, setFirst] = useState(0);
  const [useDraft, setUseDraft] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdmin = !!getAdminToken();

  const setName = (i: number, value: string) => setNames(names.map((n, j) => (j === i ? value : n)));
  const resize = (count: number) => {
    setNames(Array.from({ length: count }, (_, i) => names[i] ?? ''));
    if (first >= count) setFirst(0);
  };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = names.map((n, i) => n.trim() || `Player ${i + 1}`);
    setBusy(true);
    setError('');
    try {
      const setupData: SetupData = { names: trimmed, firstPlayer: String(first) };
      if (useDraft) setupData.draftToken = (await api.draftToken()).token;
      const { matchID } = await lobby.createMatch('phoenicians', { numPlayers: trimmed.length, setupData });
      navigate(`/match/${matchID}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the match');
      setBusy(false);
    }
  }

  return (
    <section className="panel narrow">
      <h1>New game</h1>
      <p className="muted">List everyone in seat order and mark the youngest, who goes first. You'll get a link to share.</p>
      <form onSubmit={create} className="stack">
        <label className="row">
          Players
          <select value={names.length} onChange={(e) => resize(Number(e.target.value))}>
            {[3, 4, 5, 6, 7].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        {names.map((n, i) => (
          <div className="row" key={i}>
            <input value={n} placeholder={`Player ${i + 1}`} onChange={(e) => setName(i, e.target.value)} maxLength={24} />
            <label className="radio">
              <input type="radio" name="first" checked={first === i} onChange={() => setFirst(i)} />
              Youngest
            </label>
          </div>
        ))}
        {isAdmin && (
          <label className="radio">
            <input type="checkbox" checked={useDraft} onChange={(e) => setUseDraft(e.target.checked)} />
            Test the unpublished draft config
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create game'}
        </button>
      </form>
    </section>
  );
}
