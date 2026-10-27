const bcrypt = require('bcryptjs');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { audit } = require('../utils/audit');

const PUBLIC = 'id, name, email, role, is_active, created_at';

async function list() {
  const { rows } = await db.query(`SELECT ${PUBLIC} FROM users ORDER BY role, name`);
  return rows;
}

// Staff accounts only. The owner account is created once by `npm run seed:owner`.
async function createStaff({ name, email, password }, ctx) {
  const hash = await bcrypt.hash(password, 12);
  return db.withTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'staff') RETURNING ${PUBLIC}`,
      [name, email, hash]
    );
    await audit(c, ctx, { action: 'user_create', entityType: 'user', entityId: rows[0].id, newValues: { name, email, role: 'staff' } });
    return rows[0];
  });
}

async function update(id, body, ctx) {
  return db.withTransaction(async (c) => {
    const { rows: found } = await c.query(`SELECT ${PUBLIC} FROM users WHERE id = $1 FOR UPDATE`, [id]);
    const user = found[0];
    if (!user) throw new AppError(404, 'User not found');
    if (user.role === 'owner' && body.is_active === false) throw new AppError(400, 'The owner account cannot be deactivated');
    if (user.id === ctx.userId && body.is_active === false) throw new AppError(400, 'You cannot deactivate yourself');

    const hash = body.password ? await bcrypt.hash(body.password, 12) : null;
    const { rows } = await c.query(
      `UPDATE users SET name = COALESCE($2, name), is_active = COALESCE($3, is_active),
         password_hash = COALESCE($4, password_hash), failed_attempts = 0, locked_until = NULL, updated_at = now()
       WHERE id = $1 RETURNING ${PUBLIC}`,
      [id, body.name ?? null, body.is_active ?? null, hash]
    );
    await audit(c, ctx, {
      action: body.password ? 'user_password_reset' : 'user_update', entityType: 'user', entityId: id,
      oldValues: { name: user.name, is_active: user.is_active },
      newValues: { name: rows[0].name, is_active: rows[0].is_active },
    });
    return rows[0];
  });
}

// Staff accounts can be deleted only if they never recorded anything (no payments received or voided,
// no changes in the audit log other than logging in/out). Otherwise deactivate, so accountability is kept.
async function remove(id, ctx) {
  return db.withTransaction(async (c) => {
    const { rows } = await c.query(`SELECT ${PUBLIC} FROM users WHERE id = $1 FOR UPDATE`, [id]);
    const user = rows[0];
    if (!user) throw new AppError(404, 'User not found');
    if (user.role === 'owner') throw new AppError(400, 'The owner account cannot be deleted');
    if (user.id === ctx.userId) throw new AppError(400, 'You cannot delete your own account');

    const { rows: used } = await c.query(
      `SELECT 1 FROM payments WHERE received_by = $1 OR voided_by = $1
       UNION ALL
       SELECT 1 FROM audit_logs WHERE user_id = $1 AND action NOT IN ('login', 'login_failed', 'logout')
       LIMIT 1`,
      [id]
    );
    if (used.length) {
      throw new AppError(409, 'This staff member has recorded payments or changes, so the account cannot be deleted. Deactivate it instead.');
    }
    await c.query('DELETE FROM users WHERE id = $1', [id]);
    await audit(c, ctx, { action: 'user_delete', entityType: 'user', entityId: id, oldValues: { name: user.name, email: user.email, role: user.role } });
    return { id, deleted: true };
  });
}

module.exports = { list, createStaff, update, remove };