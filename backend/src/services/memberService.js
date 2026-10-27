const db = require('../config/db');
const AppError = require('../utils/AppError');
const { audit } = require('../utils/audit');
const { today } = require('../utils/dates');
const { toCsv } = require('../utils/csv');

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

async function list({ q, status, overdue, page, limit }) {
  const params = [today()];
  const where = [];
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    const n = params.length;
    where.push(`(m.full_name ILIKE $${n} OR m.phone ILIKE $${n} OR m.member_code ILIKE $${n})`);
  }
  if (status) { params.push(status); where.push(`m.status = $${params.length}`); }
  if (overdue === 'true') where.push('COALESCE(b.overdue, 0) > 0');
  params.push(limit, (page - 1) * limit);

  const { rows } = await db.query(
    `SELECT m.*, COALESCE(b.outstanding, 0) AS outstanding, COALESCE(b.overdue, 0) AS overdue,
            COUNT(*) OVER() AS total_count
     FROM members m
     LEFT JOIN (
       SELECT member_id,
              SUM(balance) FILTER (WHERE due_date <= $1::date) AS outstanding,
              SUM(balance) FILTER (WHERE due_date <  $1::date) AS overdue
       FROM v_billing_balances
       WHERE balance > 0 AND membership_status = 'active'
       GROUP BY member_id
     ) b ON b.member_id = m.id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    data: rows.map(({ total_count, ...r }) => r),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

async function getDetail(id) {
  const { rows } = await db.query('SELECT * FROM members WHERE id = $1', [id]);
  if (!rows[0]) throw new AppError(404, 'Member not found');
  const t = today();

  const [memberships, periods, payments, totals] = await Promise.all([
    db.query(
      `SELECT mm.*, p.name AS plan_name FROM member_memberships mm
       JOIN membership_plans p ON p.id = mm.plan_id WHERE mm.member_id = $1 ORDER BY mm.start_date DESC`, [id]),
    db.query('SELECT * FROM v_billing_balances WHERE member_id = $1 ORDER BY due_date DESC', [id]),
    db.query(
      `SELECT p.*, u.name AS received_by_name,
              COALESCE(json_agg(json_build_object('billing_period_id', pa.billing_period_id,
                       'amount', pa.amount, 'period_start', bp.period_start))
                       FILTER (WHERE pa.id IS NOT NULL), '[]') AS allocations
       FROM payments p
       LEFT JOIN users u ON u.id = p.received_by
       LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
       LEFT JOIN billing_periods bp ON bp.id = pa.billing_period_id
       WHERE p.member_id = $1 GROUP BY p.id, u.name ORDER BY p.paid_on DESC, p.id DESC`, [id]),
    db.query(
      `SELECT COALESCE(SUM(amount_due), 0) AS total_fees, COALESCE(SUM(amount_paid), 0) AS total_paid,
              COALESCE(SUM(balance) FILTER (WHERE due_date <= $2::date), 0) AS outstanding,
              COALESCE(SUM(balance) FILTER (WHERE due_date <  $2::date), 0) AS overdue
       FROM v_billing_balances WHERE member_id = $1 AND membership_status = 'active'`, [id, t]),
  ]);

  return {
    member: rows[0],
    memberships: memberships.rows,
    billing_periods: periods.rows,
    payments: payments.rows,
    totals: totals.rows[0],
  };
}

async function create(body, ctx) {
  return db.withTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO members (full_name, phone, email, joining_date, notes, created_by)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6) RETURNING *`,
      [body.full_name, body.phone, body.email, body.joining_date ?? null, body.notes, ctx.userId]
    );
    await audit(c, ctx, { action: 'member_create', entityType: 'member', entityId: rows[0].id, newValues: rows[0] });
    return rows[0];
  });
}

async function update(id, body, ctx) {
  return db.withTransaction(async (c) => {
    const { rows: old } = await c.query('SELECT * FROM members WHERE id = $1 FOR UPDATE', [id]);
    if (!old[0]) throw new AppError(404, 'Member not found');
    const { rows } = await c.query(
      `UPDATE members SET full_name = $2, phone = $3, email = $4,
         joining_date = COALESCE($5::date, joining_date), notes = $6, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, body.full_name, body.phone, body.email, body.joining_date ?? null, body.notes]
    );
    await audit(c, ctx, { action: 'member_update', entityType: 'member', entityId: id, oldValues: old[0], newValues: rows[0] });
    return rows[0];
  });
}

// Members are never hard-deleted (payment history must survive); they are deactivated instead.
async function setStatus(id, status, ctx) {
  return db.withTransaction(async (c) => {
    const { rows: old } = await c.query('SELECT * FROM members WHERE id = $1 FOR UPDATE', [id]);
    if (!old[0]) throw new AppError(404, 'Member not found');
    const { rows } = await c.query('UPDATE members SET status = $2, updated_at = now() WHERE id = $1 RETURNING *', [id, status]);
    await audit(c, ctx, {
      action: status === 'inactive' ? 'member_deactivate' : 'member_activate', entityType: 'member', entityId: id,
      oldValues: { status: old[0].status }, newValues: { status },
    });
    return rows[0];
  });
}

// Hard delete is only allowed for members with NO payment history (added by mistake, or test data).
// Anyone who has ever paid must be deactivated instead, so financial records are never lost.
async function remove(id, ctx) {
  return db.withTransaction(async (c) => {
    const { rows } = await c.query('SELECT * FROM members WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) throw new AppError(404, 'Member not found');
    const { rows: paid } = await c.query('SELECT 1 FROM payments WHERE member_id = $1 LIMIT 1', [id]);
    if (paid.length) {
      throw new AppError(409, 'This member has payment history, so it cannot be deleted. Deactivate the member instead.');
    }
    await c.query('DELETE FROM notifications WHERE member_id = $1', [id]);
    await c.query('DELETE FROM billing_periods WHERE membership_id IN (SELECT id FROM member_memberships WHERE member_id = $1)', [id]);
    await c.query('DELETE FROM member_memberships WHERE member_id = $1', [id]);
    await c.query('DELETE FROM members WHERE id = $1', [id]);
    await audit(c, ctx, { action: 'member_delete', entityType: 'member', entityId: id, oldValues: rows[0] });
    return { id, deleted: true };
  });
}

async function exportCsv() {
  const { rows } = await db.query(
    `SELECT member_code, full_name, phone, email, joining_date, status FROM members ORDER BY member_code`);
  return toCsv([
    { key: 'member_code', label: 'Member ID' }, { key: 'full_name', label: 'Name' },
    { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' },
    { key: 'joining_date', label: 'Joined' }, { key: 'status', label: 'Status' },
  ], rows);
}

module.exports = { list, getDetail, create, update, setStatus, remove, exportCsv };