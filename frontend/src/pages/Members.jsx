import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg, apiBase } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import { money } from '../utils/format';

const empty = { full_name: '', phone: '', email: '', notes: '' };

export default function Members() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], pagination: null });
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    const params = { page, limit: 15 };
    if (q.trim()) params.q = q.trim();
    if (status) params.status = status;
    if (overdue) params.overdue = 'true';
    api.get('/members', { params }).then((r) => { setRes(r.data); setError(''); }).catch((e) => setError(errMsg(e)));
  }, [q, status, overdue, page]);

  // small debounce so we do not hit the API on every keystroke
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const add = async (e) => {
    e.preventDefault(); setFormError('');
    try {
      await api.post('/members', form);
      setForm(empty); setShowForm(false); setPage(1); load();
    } catch (err) { setFormError(errMsg(err)); }
  };

  return (
    <div>
      <div className="head">
        <h1>Members</h1>
        <div className="row">
          {user.role === 'owner' && <a className="btn" href={`${apiBase}/members/export.csv`}>Export CSV</a>}
          <button className="primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Add member'}</button>
        </div>
      </div>

      {showForm && (
        <form className="panel grid" onSubmit={add}>
          <label>Full name<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
          <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></label>
          <label>Email (for reminders)<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          {formError && <p className="error full">{formError}</p>}
          <button className="primary">Save member</button>
        </form>
      )}

      <div className="filters">
        <input placeholder="Search name, phone or member ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <label className="check"><input type="checkbox" checked={overdue} onChange={(e) => { setOverdue(e.target.checked); setPage(1); }} /> Overdue only</label>
      </div>

      {error && <p className="error">{error}</p>}
      <section className="panel scroll">
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Status</th><th className="num">Outstanding</th><th className="num">Overdue</th></tr></thead>
          <tbody>
            {res.data.map((m) => (
              <tr key={m.id}>
                <td>{m.member_code}</td>
                <td><Link to={`/members/${m.id}`}>{m.full_name}</Link></td>
                <td>{m.phone}</td>
                <td><span className={`tag ${m.status}`}>{m.status}</span></td>
                <td className="num">{money(m.outstanding)}</td>
                <td className={`num ${Number(m.overdue) > 0 ? 'bad' : ''}`}>{money(m.overdue)}</td>
              </tr>
            ))}
            {res.data.length === 0 && <tr><td colSpan="6" className="muted">No members match. Try a different search, or add a member.</td></tr>}
          </tbody>
        </table>
      </section>
      <Pagination pagination={res.pagination} onPage={setPage} />
    </div>
  );
}
