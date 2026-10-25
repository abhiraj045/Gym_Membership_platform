import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg, apiBase } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { money } from '../utils/format';

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    api.get('/reports/dashboard').then((r) => setD(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  const runReminders = async () => {
    setNote('Running…');
    try {
      const r = await api.post('/reminders/run');
      setNote(`Done: ${r.data.sent} sent, ${r.data.failed} failed, ${r.data.skipped_duplicates} already sent today.`);
    } catch (e) { setNote(errMsg(e)); }
  };

  if (error) return <p className="error">{error}</p>;
  if (!d) return <p className="muted">Loading…</p>;
  const s = d.summary;
  const max = Math.max(1, ...d.monthly.map((m) => Number(m.total)));

  return (
    <div>
      <div className="head">
        <h1>Dashboard</h1>
        {user.role === 'owner' && <button onClick={runReminders}>Send reminders now</button>}
      </div>
      {note && <p className="muted">{note}</p>}

      <div className="stats">
        <Stat label="Active members" value={s.active_members} />
        <Stat label="Expiring in 14 days" value={s.expiring_soon} />
        <Stat label="Collected this month" value={money(s.collected_this_month)} />
        <Stat label="Total collected" value={money(s.total_collected)} />
        <Stat label="Outstanding" value={money(s.outstanding)} />
        <Stat label="Overdue" value={money(s.overdue_amount)} sub={`${s.overdue_members} members`} warn={Number(s.overdue_amount) > 0} />
      </div>

      <div className="two">
        <section className="panel">
          <h2>Monthly collections</h2>
          {d.monthly.length === 0 ? <p className="muted">No payments recorded yet.</p> : d.monthly.map((m) => (
            <div className="bar-row" key={m.month}>
              <span className="small">{m.month}</span>
              <div className="bar"><div style={{ width: `${(Number(m.total) / max) * 100}%` }} /></div>
              <span className="small num">{money(m.total)}</span>
            </div>
          ))}
        </section>

        <section className="panel">
          <h2>Memberships ending soon</h2>
          {d.expiring.length === 0 ? <p className="muted">Nothing ending in the next 14 days.</p> : (
            <table><tbody>{d.expiring.map((x) => (
              <tr key={x.member_id}><td><Link to={`/members/${x.member_id}`}>{x.full_name}</Link></td><td>{x.plan_name}</td><td>{x.end_date}</td></tr>
            ))}</tbody></table>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="head">
          <h2>Overdue members</h2>
          {user.role === 'owner' && <a className="btn" href={`${apiBase}/reports/overdue.csv`}>Download CSV</a>}
        </div>
        {d.overdue.length === 0 ? <p className="muted">No overdue fees.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Member</th><th>Phone</th><th className="num">Overdue</th><th>Oldest due</th><th className="num">Days late</th></tr></thead>
            <tbody>{d.overdue.map((x) => (
              <tr key={x.member_id}>
                <td><Link to={`/members/${x.member_id}`}>{x.full_name}</Link></td><td>{x.phone}</td>
                <td className="num">{money(x.overdue_amount)}</td><td>{x.oldest_due_date}</td><td className="num">{x.days_overdue}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub, warn }) {
  return (
    <div className={`stat${warn ? ' warn' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
  );
}
