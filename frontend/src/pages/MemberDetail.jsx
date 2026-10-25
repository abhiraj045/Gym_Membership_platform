import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { money, label } from '../utils/format';

export default function MemberDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isOwner = user.role === 'owner';
  const [d, setD] = useState(null);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({});
  const [ms, setMs] = useState({ plan_id: '', start_date: '', term_months: '', billing_period_months: '', price_per_period: '' });
  const [pay, setPay] = useState({ amount: '', method: 'cash', reference_no: '', paid_on: '', billing_period_id: '' });
  const [dupAsk, setDupAsk] = useState(false);

  const load = useCallback(() => {
    api.get(`/members/${id}`).then((r) => { setD(r.data); setError(''); }).catch((e) => setError(errMsg(e)));
  }, [id]);

  useEffect(() => { load(); api.get('/plans').then((r) => setPlans(r.data.data)); }, [load]);

  const run = async (fn, okMsg) => {
    setMsg(''); setError('');
    try { await fn(); if (okMsg) setMsg(okMsg); load(); return true; }
    catch (e) { setError(errMsg(e)); return false; }
  };

  if (!d) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  const { member, memberships, billing_periods: periods, payments, totals } = d;
  const openPeriods = periods.filter((p) => Number(p.balance) > 0 && p.membership_status === 'active');
  const today = new Date().toISOString().slice(0, 10);

  const startEdit = () => {
    setEdit({ full_name: member.full_name, phone: member.phone, email: member.email || '', notes: member.notes || '' });
    setEditing(true);
  };

  const addMembership = (e) => {
    e.preventDefault();
    const body = { plan_id: Number(ms.plan_id), start_date: ms.start_date };
    if (ms.term_months) body.term_months = Number(ms.term_months);
    if (ms.billing_period_months) body.billing_period_months = Number(ms.billing_period_months);
    if (ms.price_per_period) body.price_per_period = ms.price_per_period;
    run(() => api.post(`/members/${id}/memberships`, body), 'Membership created and bills generated.');
  };

  const recordPayment = async (e, allowDuplicate = false) => {
    e?.preventDefault();
    const body = { member_id: Number(id), amount: pay.amount, method: pay.method, allow_duplicate: allowDuplicate };
    if (pay.reference_no) body.reference_no = pay.reference_no;
    if (pay.paid_on) body.paid_on = pay.paid_on;
    if (pay.billing_period_id) body.billing_period_id = Number(pay.billing_period_id);
    setMsg(''); setError('');
    try {
      await api.post('/payments', body);
      setPay({ amount: '', method: 'cash', reference_no: '', paid_on: '', billing_period_id: '' });
      setDupAsk(false); setMsg('Payment recorded.'); load();
    } catch (err) {
      if (err.response?.data?.error?.details?.code === 'DUPLICATE_SUSPECTED') setDupAsk(true);
      else setError(errMsg(err));
    }
  };

  return (
    <div>
      <div className="head">
        <h1>{member.full_name} <span className={`tag ${member.status}`}>{member.status}</span></h1>
        <div className="row">
          <button onClick={startEdit}>Edit details</button>
          {isOwner && (member.status === 'active'
            ? <button onClick={() => window.confirm('Deactivate this member? Their history is kept.') && run(() => api.post(`/members/${id}/deactivate`))}>Deactivate</button>
            : <button onClick={() => run(() => api.post(`/members/${id}/activate`))}>Activate</button>)}
        </div>
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="error">{error}</p>}

      {editing ? (
        <form className="panel grid" onSubmit={(e) => { e.preventDefault(); run(() => api.put(`/members/${id}`, edit), 'Details saved.').then((ok) => ok && setEditing(false)); }}>
          <label>Full name<input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} required /></label>
          <label>Phone<input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} required /></label>
          <label>Email<input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label>
          <label>Notes<input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
          <div className="row"><button className="primary">Save</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></div>
        </form>
      ) : (
        <section className="panel info">
          <div><span className="muted small">Member ID</span><br />{member.member_code}</div>
          <div><span className="muted small">Phone</span><br />{member.phone}</div>
          <div><span className="muted small">Email</span><br />{member.email || '—'}</div>
          <div><span className="muted small">Joined</span><br />{member.joining_date}</div>
          {member.notes && <div className="full"><span className="muted small">Notes</span><br />{member.notes}</div>}
        </section>
      )}

      <div className="stats">
        <div className="stat"><div className="stat-label">Total fees</div><div className="stat-value">{money(totals.total_fees)}</div></div>
        <div className="stat"><div className="stat-label">Paid</div><div className="stat-value">{money(totals.total_paid)}</div></div>
        <div className="stat"><div className="stat-label">Outstanding now</div><div className="stat-value">{money(totals.outstanding)}</div></div>
        <div className={`stat${Number(totals.overdue) > 0 ? ' warn' : ''}`}><div className="stat-label">Overdue</div><div className="stat-value">{money(totals.overdue)}</div></div>
      </div>

      <section className="panel">
        <h2>Billing periods</h2>
        <div className="scroll"><table>
          <thead><tr><th>Period</th><th>Due</th><th className="num">Fee</th><th className="num">Paid</th><th className="num">Balance</th><th>Status</th></tr></thead>
          <tbody>
            {periods.map((p) => {
              const late = p.due_date < today && Number(p.balance) > 0;
              return (
                <tr key={p.billing_period_id}>
                  <td>{p.period_start} to {p.period_end}</td><td>{p.due_date}</td>
                  <td className="num">{money(p.amount_due)}</td><td className="num">{money(p.amount_paid)}</td><td className="num">{money(p.balance)}</td>
                  <td><span className={`tag ${late ? 'overdue' : p.payment_status}`}>{late ? 'overdue' : p.payment_status}</span>{p.membership_status === 'cancelled' && <span className="muted small"> cancelled plan</span>}</td>
                </tr>
              );
            })}
            {periods.length === 0 && <tr><td colSpan="6" className="muted">No bills yet. Add a membership below to generate them.</td></tr>}
          </tbody>
        </table></div>
      </section>

      <div className="two">
        <section className="panel">
          <h2>Record payment</h2>
          {openPeriods.length === 0 ? <p className="muted">Nothing is owed right now.</p> : (
            <form className="stack" onSubmit={recordPayment}>
              <label>Amount<input inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required placeholder="e.g. 500.00" /></label>
              <label>Method
                <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                  {['cash', 'upi', 'card', 'bank_transfer', 'other'].map((m) => <option key={m} value={m}>{label(m)}</option>)}
                </select>
              </label>
              <label>Reference no. (optional)<input value={pay.reference_no} onChange={(e) => setPay({ ...pay, reference_no: e.target.value })} /></label>
              <label>Date paid (blank = today)<input type="date" value={pay.paid_on} onChange={(e) => setPay({ ...pay, paid_on: e.target.value })} /></label>
              <label>Apply to
                <select value={pay.billing_period_id} onChange={(e) => setPay({ ...pay, billing_period_id: e.target.value })}>
                  <option value="">Oldest unpaid first</option>
                  {openPeriods.map((p) => <option key={p.billing_period_id} value={p.billing_period_id}>{p.period_start} (owes {money(p.balance)})</option>)}
                </select>
              </label>
              {dupAsk && (
                <div className="warnbox">
                  An identical payment was recorded in the last 5 minutes. Is this a second, separate payment?
                  <div className="row"><button type="button" className="primary" onClick={() => recordPayment(null, true)}>Yes, record it</button><button type="button" onClick={() => setDupAsk(false)}>No, cancel</button></div>
                </div>
              )}
              <button className="primary">Record payment</button>
            </form>
          )}
        </section>

        <section className="panel">
          <h2>Add membership</h2>
          <form className="stack" onSubmit={addMembership}>
            <label>Plan
              <select value={ms.plan_id} onChange={(e) => setMs({ ...ms, plan_id: e.target.value })} required>
                <option value="">Choose a plan</option>
                {plans.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.duration_months} mo, {money(p.default_price)})</option>)}
              </select>
            </label>
            <label>Start date<input type="date" value={ms.start_date} onChange={(e) => setMs({ ...ms, start_date: e.target.value })} required /></label>
            <label>Custom price per billing period (optional)<input inputMode="decimal" value={ms.price_per_period} onChange={(e) => setMs({ ...ms, price_per_period: e.target.value })} /></label>
            <div className="row">
              <label>Term (months)<input type="number" min="1" value={ms.term_months} onChange={(e) => setMs({ ...ms, term_months: e.target.value })} placeholder="plan length" /></label>
              <label>Bill every (months)<input type="number" min="1" value={ms.billing_period_months} onChange={(e) => setMs({ ...ms, billing_period_months: e.target.value })} placeholder="plan length" /></label>
            </div>
            <p className="muted small">If you change the billing length, you must enter the price per billing period.</p>
            <button className="primary">Create membership</button>
          </form>
        </section>
      </div>

      <section className="panel">
        <h2>Memberships</h2>
        <div className="scroll"><table>
          <thead><tr><th>Plan</th><th>From</th><th>To</th><th className="num">Price / period</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {memberships.map((m) => (
              <tr key={m.id}>
                <td>{m.plan_name}</td><td>{m.start_date}</td><td>{m.end_date}</td><td className="num">{money(m.price_per_period)}</td>
                <td><span className={`tag ${m.status === 'active' ? 'active' : 'inactive'}`}>{m.status}</span></td>
                <td className="row">
                  {m.status === 'active' && <button onClick={() => window.confirm('Renew starting the day after this one ends?') && run(() => api.post(`/memberships/${m.id}/renew`, {}), 'Renewed.')}>Renew</button>}
                  {isOwner && m.status === 'active' && <button onClick={() => window.confirm('Cancel this membership? Future unpaid bills are removed; history stays.') && run(() => api.post(`/memberships/${m.id}/cancel`), 'Membership cancelled.')}>Cancel</button>}
                </td>
              </tr>
            ))}
            {memberships.length === 0 && <tr><td colSpan="6" className="muted">No memberships yet.</td></tr>}
          </tbody>
        </table></div>
      </section>

      <section className="panel">
        <h2>Payment history</h2>
        <div className="scroll"><table>
          <thead><tr><th>Date</th><th className="num">Amount</th><th>Method</th><th>Reference</th><th>Applied to</th><th>By</th><th></th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className={p.is_void ? 'void' : ''}>
                <td>{p.paid_on}</td><td className="num">{money(p.amount)}</td><td>{label(p.method)}</td><td>{p.reference_no || '—'}</td>
                <td>{p.allocations.map((a) => `${a.period_start}: ${money(a.amount)}`).join(', ')}</td>
                <td>{p.received_by_name || '—'}</td>
                <td>{p.is_void ? <span className="tag overdue" title={p.void_reason}>void</span>
                  : isOwner && <button onClick={() => { const r = window.prompt('Reason for voiding this payment (min 5 characters):'); if (r) run(() => api.post(`/payments/${p.id}/void`, { reason: r }), 'Payment voided. Record the corrected payment if needed.'); }}>Void</button>}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan="7" className="muted">No payments yet.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
