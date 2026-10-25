import { useEffect, useState } from 'react';
import { Admin } from './pages/Admin';
import { Changelog } from './pages/Changelog';
import { Home } from './pages/Home';
import { MatchPage } from './pages/MatchPage';

export function navigate(to: string) {
  window.history.pushState(null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function Link({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

export function App() {
  const path = usePath();
  const match = path.match(/^\/match\/([^/]+)/);
  let page: React.ReactNode;
  if (match) page = <MatchPage matchID={match[1]!} />;
  else if (path === '/admin') page = <Admin />;
  else if (path === '/changelog') page = <Changelog />;
  else page = <Home />;

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">Phoenicians</Link>
        <nav>
          <Link to="/changelog">What's new</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </header>
      <main>{page}</main>
    </div>
  );
}
