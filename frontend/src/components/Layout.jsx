import { useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useTableLabels from './useTableLabels';

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const mainRef = useRef(null);
  useTableLabels(mainRef);
  const isOwner = user?.role === 'owner';
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Gym Fees</div>
        <nav>
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