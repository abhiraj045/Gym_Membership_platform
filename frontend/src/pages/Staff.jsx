import { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';

export default function Staff() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api.get('/users').then((r) => setUsers(r.data.data)).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, []);

  const act = async (fn, ok) => {
    setError(''); setMsg('');
    try { await fn(); if (ok) setMsg(ok); load(); } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div>
      <h1>Staff</h1>
      <form className="panel grid" onSubmit={(e) => { e.preventDefault(); act(async () => { await api.post('/users', form); setForm({ name: '', email: '', password: '' }); }, 'Staff account created.'); }}>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>Temporary password (min 10 characters)<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} autoComplete="new-password" /></label>
        <button className="primary">Create staff account</button>
      </form>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="error">{error}</p>}
      <section className="panel scroll">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
                <td><span className={`tag ${u.is_active ? 'active' : 'inactive'}`}>{u.is_active ? 'active' : 'deactivated'}</span></td>
                <td className="row">
                  {u.role === 'staff' && <button onClick={() => act(() => api.put(`/users/${u.id}`, { is_active: !u.is_active }))}>{u.is_active ? 'Deactivate' : 'Activate'}</button>}
                  {u.role === 'staff' && <button onClick={() => { const p = window.prompt('New password (min 10 characters):'); if (p) act(() => api.put(`/users/${u.id}`, { password: p }), 'Password reset.'); }}>Reset password</button>}
                  {u.role === 'staff' && <button style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={() => window.confirm(`Delete the staff account for ${u.name}? This cannot be undone.\n\nIf they have recorded payments or changes, use Deactivate instead.`) && act(() => api.delete(`/users/${u.id}`), 'Staff account deleted.')}>Delete</button>}
                </td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
