const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Verifies the session cookie AND re-checks the user in the database on every request,
// so deactivating a staff member takes effect immediately.
const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.cookies[env.cookieName];
  if (!token) throw new AppError(401, 'Not logged in');
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError(401, 'Session expired. Please log in again.');
  }
  const { rows } = await db.query(
    'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
    [payload.sub]
  );
  if (!rows[0] || !rows[0].is_active) throw new AppError(401, 'Account is not active');
  req.user = rows[0];
  req.ctx = { userId: rows[0].id, ip: req.ip };
  next();
});

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'You do not have permission to do this'));
  }
  next();
};

// CSRF defence: cookies are SameSite and CORS is restricted to our frontend, and we additionally
// require a custom header on every state-changing request. Browsers cannot send custom headers
// cross-site without a CORS preflight, which our allow-list rejects for other origins.
const csrfGuard = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (req.get('x-requested-with') !== 'XMLHttpRequest') {
      return next(new AppError(403, 'Missing request header'));
    }
  }
  next();
};

module.exports = { authenticate, requireRole, csrfGuard };
