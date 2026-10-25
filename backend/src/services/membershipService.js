const db = require('../config/db');
const AppError = require('../utils/AppError');
const { audit } = require('../utils/audit');
const { addDays, today, buildPeriods } = require('../utils/dates');

// Creates a membership and ALL its billing periods in one transaction.
async function createInternal(c, ctx, { memberId, planId, startDate, termMonths, billingMonths, price }) {
  const { rows: m } = await c.query('SELECT id, status FROM members WHERE id = $1 FOR UPDATE', [memberId]);
  if (!m[0]) throw new AppError(404, 'Member not found');
  if (m[0].status !== 'active') throw new AppError(400, 'Member is inactive. Activate the member first.');

  const { rows: p } = await c.query('SELECT * FROM membership_plans WHERE id = $1', [planId]);
  const plan = p[0];
  if (!plan) throw new AppError(404, 'Plan not found');
  if (!plan.is_active) throw new AppError(400, 'This plan is not active');

  const term = termMonths || plan.duration_months;
  const billing = billingMonths || Math.min(plan.duration_months, term);
  if (billing > term) throw new AppError(400, 'Billing period cannot be longer than the membership term');

  // The plan's default price covers one plan-length period. For any other billing length, the price must be given.
  let fee = price;
  if (fee === undefined || fee === null) {
    if (billing !== plan.duration_months) {
      throw new AppError(400, 'Enter the price per billing period (custom billing length)');
    }
    fee = plan.default_price;
  }

  const { periods, endDate } = buildPeriods(startDate, term, billing);

  const { rows: overlap } = await c.query(
    `SELECT 1 FROM member_memberships WHERE member_id = $1 AND status = 'active'
       AND start_date <= $3::date AND end_date >= $2::date LIMIT 1`,
    [memberId, startDate, endDate]
  );
  if (overlap.length) throw new AppError(409, 'This member already has an active membership overlapping those dates');

  const { rows: ms } = await c.query(
    `INSERT INTO member_memberships (member_id, plan_id, start_date, end_date, term_months, billing_period_months, price_per_period, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [memberId, planId, startDate, endDate, term, billing, fee, ctx.userId]
  );
  const membership = ms[0];
  for (const per of periods) {
    await c.query(
      `INSERT INTO billing_periods (membership_id, period_start, period_end, due_date, amount_due)
       VALUES ($1, $2, $3, $4, $5)`,
      [membership.id, per.period_start, per.period_end, per.due_date, fee]
    );
  }
  await audit(c, ctx, {
    action: 'membership_create', entityType: 'membership', entityId: membership.id,
    newValues: { ...membership, periods: periods.length },
  });
  return { ...membership, periods_created: periods.length };
}

const create = (memberId, body, ctx) =>
  db.withTransaction((c) => createInternal(c, ctx, {
    memberId, planId: body.plan_id, startDate: body.start_date,
    termMonths: body.term_months, billingMonths: body.billing_period_months, price: body.price_per_period,
  }));

// Renewal = a new membership starting the day after the old one ends, same term/billing/price unless overridden.
async function renew(id, body, ctx) {
  return db.withTransaction(async (c) => {
    const { rows } = await c.query('SELECT * FROM member_memberships WHERE id = $1', [id]);
    const old = rows[0];
    if (!old) throw new AppError(404, 'Membership not found');
    if (old.status !== 'active') throw new AppError(400, 'Only active memberships can be renewed');
    return createInternal(c, ctx, {
      memberId: old.member_id, planId: old.plan_id, startDate: addDays(old.end_date, 1),
      termMonths: old.term_months, billingMonths: old.billing_period_months,
      price: body.price_per_period ?? old.price_per_period,
    });
  });
}

// Cancelling removes FUTURE periods that have no payments on them. Past/paid history is untouched.
async function cancel(id, ctx) {
  return db.withTransaction(async (c) => {
    const { rows } = await c.query('SELECT * FROM member_memberships WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) throw new AppError(404, 'Membership not found');
    if (rows[0].status === 'cancelled') throw new AppError(409, 'Already cancelled');
    await c.query("UPDATE member_memberships SET status = 'cancelled' WHERE id = $1", [id]);
    const del = await c.query(
      `DELETE FROM billing_periods bp WHERE bp.membership_id = $1 AND bp.due_date > $2::date
         AND NOT EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.billing_period_id = bp.id)`,
      [id, today()]
    );
    await audit(c, ctx, {
      action: 'membership_cancel', entityType: 'membership', entityId: id,
      oldValues: { status: rows[0].status }, newValues: { status: 'cancelled', future_periods_removed: del.rowCount },
    });
    return { id, status: 'cancelled', future_periods_removed: del.rowCount };
  });
}

module.exports = { create, renew, cancel };
