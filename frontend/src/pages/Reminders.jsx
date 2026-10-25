import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';
import Pagination from '../components/Pagination';

const toList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean).map(Number);

export default function Reminders() {
  const [s, setS] = useState(null);
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [log, setLog] = useState({ data: [], pagination: null });
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reminders/settings').then((r) => { setS(r.data); setBefore(r.data.days_before.join(', ')); setAfter(r.data.days_after.join(', ')); }).catch((e) => setError(errMsg(e)));
  }, []);
  const loadLog = useCallback(() => api.get('/reminders/notifications', { params: { page, limit: 20 } }).then((r) => setLog(r.data)).catch((e) => setError(errMsg(e))), [page]);
  useEffect(() => { loadLog(); }, [loadLog]);

  const save = async (e) => {
    e.preventDefault(); setMsg(''); setError('');
    try {
      const r = await api.put('/reminders/settings', { days_before: toList(before), days_after: toList(after), send_owner_summary: s.send_owner_summary });
      setS(r.data); setMsg('Schedule saved.');
    } catch (err) { setError(errMsg(err)); }
  };

  if (!s) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  return (
    <div>
      <h1>Reminders</h1>
      <form className="panel grid" onSubmit={save}>
        <label>Remind this many days BEFORE the due date<input value={before} onChange={(e) => setBefore(e.target.value)} placeholder="7, 3, 1" /></label>
        <label>Remind this many days AFTER the due date (overdue)<input value={after} onChange={(e) => setAfter(e.target.value)} placeholder="1, 7, 14" /></label>
        <label className="check"><input type="checkbox" checked={s.send_owner_summary} onChange={(e) => setS({ ...s, send_owner_summary: e.target.checked })} /> Email me a daily summary</label>
        <button className="primary">Save schedule</button>
      </form>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="error">{error}</p>}
      <section className="panel scroll">
        <h2>Delivery log</h2>
        <table>
          <thead><tr><th>When</th><th>Type</th><th>To</th><th>Member</th><th>Status</th><th>Error</th></tr></thead>
          <tbody>
            {log.data.map((n) => (
              <tr key={n.id}><td>{new Date(n.created_at).toLocaleString()}</td><td>{n.type.replace('_', ' ')}</td><td>{n.recipient}</td><td>{n.full_name || '—'}</td>
                <td><span className={`tag ${n.status === 'sent' ? 'paid' : n.status === 'failed' ? 'overdue' : 'partial'}`}>{n.status}</span></td><td className="small">{n.error_message || ''}</td></tr>
            ))}
            {log.data.length === 0 && <tr><td colSpan="6" className="muted">No reminders sent yet.</td></tr>}
          </tbody>
        </table>
      </section>
      <Pagination pagination={log.pagination} onPage={setPage} />
    </div>
  );
}
