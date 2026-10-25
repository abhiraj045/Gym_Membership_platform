
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { audit } = require('../utils/audit');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// Used to keep response timing similar when an email is unknown.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

async function login(email, password, ctx) {
  console.log('[LOGIN DEBUG] Step 1: Login started');

  const { rows } = await db.query(
    'SELECT * FROM users WHERE lower(email) = lower($1)',
    [email]
  );

  console.log('[LOGIN DEBUG] Step 2: Database query completed');

  const user = rows[0];
  console.log('[LOGIN DEBUG] Step 3: User found =', Boolean(user));

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new AppError(401, 'Invalid email or password');
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new AppError(
      429,
      'Too many failed attempts. Try again in a few minutes.'
    );
  }

  const ok = await bcrypt.compare(password, user.password_hash);

  if (!ok || !user.is_active) {
    const attempts = (user.failed_attempts || 0) + 1;
    const lock = attempts >= MAX_ATTEMPTS;

    await db.query(
      `UPDATE users SET failed_attempts = $2,
         locked_until = CASE
           WHEN $3 THEN now() + ($4 || ' minutes')::interval
           ELSE locked_until
         END
       WHERE id = $1`,
      [user.id, lock ? 0 : attempts, lock, String(LOCK_MINUTES)]
    );

    await audit(
      db,
      { userId: user.id, ip: ctx.ip },
      {
        action: 'login_failed',
        entityType: 'user',
        entityId: user.id
      }
    );

    throw new AppError(401, 'Invalid email or password');
  }

  await db.query(
    'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1',
    [user.id]
  );

  await audit(
    db,
    { userId: user.id, ip: ctx.ip },
    {
      action: 'login',
      entityType: 'user',
      entityId: user.id
    }
  );

  const token = jwt.sign(
    { sub: user.id },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
}

module.exports = { login };
