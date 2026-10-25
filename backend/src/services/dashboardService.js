const db = require('../config/db');
const { today, addDays } = require('../utils/dates');
const { toCsv } = require('../utils/csv');

// Definitions (kept explicit so the numbers are explainable):
//  outstanding = unpaid balance on periods whose due date is today or earlier
//  overdue     = unpaid balance on periods whose due date is BEFORE today
//  expiring    = active memberships ending within N days with no renewal already lined up
async function summary() {
  const t = today();
  const monthStart = `${t.slice(0, 7)}-01`;
  const [members, expiring, money, collected] = await Promise.all([
    db.query("SELECT COUNT(*)::int AS n FROM members WHERE status = 'active'"),
    db.query(
      `SELECT COUNT(*)::int AS n FROM member_memberships mm
       WHERE mm.status = 'active' AND mm.end_date BETWEEN $1::date AND $2::date
         AND NOT EXISTS (SELECT 1 FROM member_memberships n WHERE n.member_id = mm.member_id
                         AND n.status = 'active' AND n.start_date > mm.end_date)`,
      [t, addDays(t, 14)]),
    db.query(
      `SELECT COALESCE(SUM(amount_due) FILTER (WHERE due_date <= $1::date), 0) AS total_billed,
              COALESCE(SUM(balance) FILTER (WHERE due_date <= $1::date), 0) AS outstanding,
              COALESCE(SUM(balance) FILTER (WHERE due_date <  $1::date), 0) AS overdue_amount,
              COUNT(DISTINCT member_id) FILTER (WHERE due_date < $1::date AND balance > 0)::int AS overdue_members
       FROM v_billing_balances WHERE membership_status = 'active'`, [t]),
    db.query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE paid_on >= $1::date), 0) AS this_month,
              COALESCE(SUM(amount), 0) AS all_time
       FROM payments WHERE is_void = FALSE`, [monthStart]),
  ]);
  return {
    active_members: members.rows[0].n,
    expiring_soon: expiring.rows[0].n,
    total_billed: money.rows[0].total_billed,
    total_collected: collected.rows[0].all_time,
    collected_this_month: collected.rows[0].this_month,
    outstanding: money.rows[0].outstanding,
    overdue_amount: money.rows[0].overdue_amount,
    overdue_members: money.rows[0].overdue_members,
  };
}

async function monthlyCollections(months = 12) {
  const { rows } = await db.query(
    `SELECT to_char(date_trunc('month', paid_on), 'YYYY-MM') AS month, SUM(amount) AS total, COUNT(*)::int AS payments
     FROM payments WHERE is_void = FALSE
       AND paid_on >= (date_trunc('month', $1::date) - (($2::int - 1) || ' months')::interval)::date
     GROUP BY 1 ORDER BY 1`,
    [today(), months]
  );
  return rows;
}

async function overdueList() {
  const { rows } = await db.query(
    `SELECT m.id AS member_id, m.member_code, m.full_name, m.phone, m.email,
            SUM(b.balance) AS overdue_amount, MIN(b.due_date) AS oldest_due_date,
            ($1::date - MIN(b.due_date))::int AS days_overdue
     FROM v_billing_balances b JOIN members m ON m.id = b.member_id
     WHERE b.membership_status = 'active' AND b.balance > 0 AND b.due_date < $1::date
     GROUP BY m.id ORDER BY MIN(b.due_date)`,
    [today()]
  );
  return rows;
}

async function overdueCsv() {
  return toCsv([
    { key: 'member_code', label: 'Member ID' }, { key: 'full_name', label: 'Name' }, { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' }, { key: 'overdue_amount', label: 'Overdue amount' },
    { key: 'oldest_due_date', label: 'Oldest due date' }, { key: 'days_overdue', label: 'Days overdue' },
  ], await overdueList());
}

async function expiringList(days = 14) {
  const t = today();
  const { rows } = await db.query(
    `SELECT m.id AS member_id, m.member_code, m.full_name, m.phone, mm.end_date, p.name AS plan_name
     FROM member_memberships mm JOIN members m ON m.id = mm.member_id JOIN membership_plans p ON p.id = mm.plan_id
     WHERE mm.status = 'active' AND mm.end_date BETWEEN $1::date AND $2::date
       AND NOT EXISTS (SELECT 1 FROM member_memberships n WHERE n.member_id = mm.member_id
                       AND n.status = 'active' AND n.start_date > mm.end_date)
     ORDER BY mm.end_date`,
    [t, addDays(t, days)]
  );
  return rows;
}

async function overview() {
  const [s, monthly, overdue, expiring] = await Promise.all([summary(), monthlyCollections(12), overdueList(), expiringList(14)]);
  return { summary: s, monthly, overdue: overdue.slice(0, 10), expiring: expiring.slice(0, 10) };
}

module.exports = { summary, monthlyCollections, overdueList, overdueCsv, expiringList, overview };
