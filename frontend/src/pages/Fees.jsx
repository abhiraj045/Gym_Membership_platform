import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import api, { errMsg } from '../api';
import { Alert, Badge, Empty, Pagination, fmtDate, fmtMoney } from '../components/ui.jsx';

const TABS = [['OVERDUE', 'Overdue'], ['DUE_SOON', 'Due soon'], ['ALL', 'All unpaid']];

export default function Fees() {
  const [filter, setFilter] = useState('OVERDUE');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/fees', { params: { q, filter, page, size: 10 } }).then((r) => { setData(r.data); setError(''); }).catch((e) => setError(errMsg(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, filter, page]);

  return (
    <>
      <div className="page-head"><div><h1>Fees due</h1><p className="muted">Open a member to record a payment.</p></div></div>
      <section className="card">
        <div className="toolbar">
          <div className="tabs">{TABS.map(([k, label]) => (
            <button key={k} className={'tab' + (filter === k ? ' active' : '')} onClick={() => { setFilter(k); setPage(0); }}>{label}</button>))}
          </div>
          <div className="search"><Search size={16} /><input placeholder="Search member" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        </div>
        <Alert>{error}</Alert>
        {data && data.content.length === 0 ? <Empty>Nothing here. All caught up.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Member</th><th>Period</th><th>Due date</th><th>Status</th><th className="num">Fee</th><th className="num">Paid</th><th className="num">Balance</th></tr></thead>
              <tbody>
                {data?.content.map((o) => (
                  <tr key={o.id}>
                    <td><Link to={`/members/${o.memberId}`} className="strong">{o.memberName}</Link><div className="muted small">{o.memberPhone}</div></td>
                    <td>{fmtDate(o.periodStart)} – {fmtDate(o.periodEnd)}</td><td>{fmtDate(o.dueDate)}</td>
                    <td><Badge status={o.status} /></td>
                    <td className="num">{fmtMoney(o.amount)}</td><td className="num">{fmtMoney(o.paid)}</td>
                    <td className="num strong">{fmtMoney(o.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
      </section>
    </>
  );
}
