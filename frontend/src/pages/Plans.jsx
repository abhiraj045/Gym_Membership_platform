import { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';
import { money } from '../utils/format';

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({ name: '', duration_months: '1', default_price: '' });
  const [error, setError] = useState('');

  const load = () => api.get('/plans').then((r) => setPlans(r.data.data)).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault(); setError('');
    try {
      await api.post('/plans', { ...form, duration_months: Number(form.duration_months) });
      setForm({ name: '', duration_months: '1', default_price: '' }); load();
    } catch (err) { setError(errMsg(err)); }
  };
  const toggle = async (p) => {
    try { await api.put(`/plans/${p.id}`, { name: p.name, duration_months: p.duration_months, default_price: p.default_price, is_active: !p.is_active }); load(); }
    catch (err) { setError(errMsg(err)); }
  };

  return (
    <div>
      <h1>Plans</h1>
      <p className="muted">Changing a plan never changes bills that already exist; each bill keeps the price it was created with.</p>
      <form className="panel grid" onSubmit={add}>
        <label>Plan name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Quarterly" /></label>
        <label>Length (months)<input type="number" min="1" max="60" value={form.duration_months} onChange={(e) => setForm({ ...form, duration_months: e.target.value })} required /></label>
        <label>Default price<input inputMode="decimal" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: e.target.value })} required /></label>
        {error && <p className="error full">{error}</p>}
        <button className="primary">Add plan</button>
      </form>
      <section className="panel scroll">
        <table>
          <thead><tr><th>Name</th><th>Length</th><th className="num">Default price</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}><td>{p.name}</td><td>{p.duration_months} months</td><td className="num">{money(p.default_price)}</td>
                <td><span className={`tag ${p.is_active ? 'active' : 'inactive'}`}>{p.is_active ? 'active' : 'inactive'}</span></td>
                <td><button onClick={() => toggle(p)}>{p.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>
            ))}
            {plans.length === 0 && <tr><td colSpan="5" className="muted">No plans yet. Add Monthly (1), Six-monthly (6) and Yearly (12) to start.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
