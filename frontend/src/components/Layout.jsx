import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useTableLabels from './useTableLabels';
import { GYM_NAME } from '../config';

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const [open, setOpen] = useState(false); // phone menu open/closed
  useTableLabels(mainRef);
  const isOwner = user?.role === 'owner';

  // close the phone menu after choosing a page, or when Escape is pressed
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell">
      <aside className={`side${open ? ' open' : ''}`}>
        <button
          type="button"
          className="menu-btn"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen(!open)}
        >
          <span /><span /><span />
        </button>
        <div className="brand" title={GYM_NAME}>{GYM_NAME}</div>
        {open && <div className="backdrop" onClick={() => setOpen(false)} />}
        <nav id="main-nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/members">Members</NavLink>
          {isOwner && <NavLink to="/plans">Plans</NavLink>}
          {isOwner && <NavLink to="/staff">Staff</NavLink>}
          {isOwner && <NavLink to="/reminders">Reminders</NavLink>}
        </nav>
        <div className="who">
          <div>{user?.name}</div>
          <div className="muted small">{user?.role}</div>
          <button className="link" onClick={async () => { await logout(); nav('/login'); }}>Log out</button>
        </div>
      </aside>
      <main className="main" ref={mainRef}><Outlet /></main>
    </div>
  );
}