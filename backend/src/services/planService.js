const db = require('../config/db');
const AppError = require('../utils/AppError');
const { audit } = require('../utils/audit');

async function list({ onlyActive = false } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM membership_plans ${onlyActive ? 'WHERE is_active = TRUE' : ''} ORDER BY duration_months, name`
  );
  return rows;
}

async function create(body, ctx) {
  return db.withTransaction(async (c) => {
    const { rows } = await c.query(
      'INSERT INTO membership_plans (name, duration_months, default_price) VALUES ($1, $2, $3) RETURNING *',
      [body.name, body.duration_months, body.default_price]
    );
    await audit(c, ctx, { action: 'plan_create', entityType: 'plan', entityId: rows[0].id, newValues: rows[0] });
    return rows[0];
  });
}

// Changing a plan's price NEVER changes existing bills: billing_periods keep their own amount_due snapshot.
async function update(id, body, ctx) {
  return db.withTransaction(async (c) => {
    const { rows: old } = await c.query('SELECT * FROM membership_plans WHERE id = $1 FOR UPDATE', [id]);
    if (!old[0]) throw new AppError(404, 'Plan not found');
    const { rows } = await c.query(
      `UPDATE membership_plans SET name = $2, duration_months = $3, default_price = $4, is_active = COALESCE($5, is_active)
       WHERE id = $1 RETURNING *`,
      [id, body.name, body.duration_months, body.default_price, body.is_active ?? null]
    );
    await audit(c, ctx, { action: 'plan_update', entityType: 'plan', entityId: id, oldValues: old[0], newValues: rows[0] });
    return rows[0];
  });
}

module.exports = { list, create, update };
