const db = require('../config/db');
const AppError = require('../utils/AppError');
const { audit } = require('../utils/audit');
const { today } = require('../utils/dates');
const { toCents, fromCents } = require('../utils/money');
const { allocate } = require('../utils/allocation');
const { toCsv } = require('../utils/csv');

async function create(body, ctx) {
  const amountCents = toCents(body.amount);
  const paidOn = body.paid_on || today();

  return db.withTransaction(async (c) => {
    // Locking the member row serialises concurrent payments for the same member,
    // so two clicks can never both allocate to the same remaining balance.
    const { rows: m } = await c.query('SELECT id, status FROM members WHERE id = $1 FOR UPDATE', [body.member_id]);
    if (!m[0]) throw new AppError(404, 'Member not found');

    if (!body.allow_duplicate) {
      const { rows: dup } = await c.query(
        `SELECT id FROM payments WHERE member_id = $1 AND amount = $2 AND paid_on = $3 AND method = $4
           AND is_void = FALSE AND created_at > now() - interval '5 minutes' LIMIT 1`,
        [body.member_id, body.amount, paidOn, body.method]
      );
      if (dup.length) {
        throw new AppError(409, 'An identical payment was just recorded. If this is a genuine second payment, confirm to record it anyway.', { code: 'DUPLICATE_SUSPECTED' });
      }
    }

    const { rows: open } = await c.query(
      `SELECT billing_period_id, balance FROM v_billing_balances
       WHERE member_id = $1 AND membership_status = 'active' AND balance > 0
       ORDER BY due_date, period_start`,
      [body.member_id]
    );
    const periods = open.map((r) => ({ id: r.billing_period_id, balanceCents: toCents(r.balance) }));

    if (body.billing_period_id && !periods.some((p) => String(p.id) === String(body.billing_period_id))) {
      throw new AppError(400, 'That billing period is not open (already fully paid, or not this member\'s)');
    }

    const { allocations, remainderCents } = allocate(amountCents, periods, body.billing_period_id);
    if (remainderCents > 0) {
      const outstanding = periods.reduce((s, p) => s + p.balanceCents, 0);
      throw new AppError(400, `Payment exceeds the total outstanding balance (${fromCents(outstanding)}). Overpayments are not accepted.`);
    }

    const { rows: pay } = await c.query(
      `INSERT INTO payments (member_id, amount, paid_on, method, reference_no, notes, received_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.member_id, body.amount, paidOn, body.method, body.reference_no, body.notes, ctx.userId]
    );
    for (const a of allocations) {
      await c.query(
        'INSERT INTO payment_allocations (payment_id, billing_period_id, amount) VALUES ($1, $2, $3)',
        [pay[0].id, a.billing_period_id, fromCents(a.cents)]
      );
    }
    await audit(c, ctx, {
      action: 'payment_create', entityType: 'payment', entityId: pay[0].id,
      newValues: { ...pay[0], allocations: allocations.map((a) => ({ billing_period_id: a.billing_period_id, amount: fromCents(a.cents) })) },
    });
    return { ...pay[0], allocations: allocations.map((a) => ({ billing_period_id: a.billing_period_id, amount: fromCents(a.cents) })) };
  });
}

// Payments are never edited or deleted. A correction = void the wrong one (reason required) + record the right one.
async function voidPayment(id, reason, ctx) {
  return db.withTransaction(async (c) => {
    const { rows } = await c.query('SELECT * FROM payments WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) throw new AppError(404, 'Payment not found');
    if (rows[0].is_void) throw new AppError(409, 'Payment is already void');
    const { rows: upd } = await c.query(
      `UPDATE payments SET is_void = TRUE, void_reason = $2, voided_by = $3, voided_at = now() WHERE id = $1 RETURNING *`,
      [id, reason, ctx.userId]
    );
    await audit(c, ctx, {
      action: 'payment_void', entityType: 'payment', entityId: id,
      oldValues: { is_void: false, amount: rows[0].amount }, newValues: { is_void: true, reason },
    });
    return upd[0];
  });
}

function buildFilter({ member_id, from, to, method }) {
  const params = []; const where = [];
  if (member_id) { params.push(member_id); where.push(`p.member_id = $${params.length}`); }
  if (from) { params.push(from); where.push(`p.paid_on >= $${params.length}::date`); }
  if (to) { params.push(to); where.push(`p.paid_on <= $${params.length}::date`); }
  if (method) { params.push(method); where.push(`p.method = $${params.length}`); }
  return { params, clause: where.length ? 'WHERE ' + where.join(' AND ') : '' };
}

async function list(query) {
  const { params, clause } = buildFilter(query);
  params.push(query.limit, (query.page - 1) * query.limit);
  const { rows } = await db.query(
    `SELECT p.*, m.full_name, m.member_code, u.name AS received_by_name, COUNT(*) OVER() AS total_count
     FROM payments p JOIN members m ON m.id = p.member_id LEFT JOIN users u ON u.id = p.received_by
     ${clause} ORDER BY p.paid_on DESC, p.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    data: rows.map(({ total_count, ...r }) => r),
    pagination: { page: query.page, limit: query.limit, total, pages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

async function exportCsv(query) {
  const { params, clause } = buildFilter(query);
  const { rows } = await db.query(
    `SELECT p.id, m.member_code, m.full_name, p.amount, p.paid_on, p.method, p.reference_no,
            CASE WHEN p.is_void THEN 'void' ELSE 'valid' END AS state, p.void_reason, u.name AS received_by
     FROM payments p JOIN members m ON m.id = p.member_id LEFT JOIN users u ON u.id = p.received_by
     ${clause} ORDER BY p.paid_on DESC, p.id DESC`,
    params
  );
  return toCsv([
    { key: 'id', label: 'Payment ID' }, { key: 'member_code', label: 'Member ID' }, { key: 'full_name', label: 'Member' },
    { key: 'amount', label: 'Amount' }, { key: 'paid_on', label: 'Paid on' }, { key: 'method', label: 'Method' },
    { key: 'reference_no', label: 'Reference' }, { key: 'state', label: 'State' }, { key: 'void_reason', label: 'Void reason' },
    { key: 'received_by', label: 'Received by' },
  ], rows);
}

module.exports = { create, voidPayment, list, exportCsv };
