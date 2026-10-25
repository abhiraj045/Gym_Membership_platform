const router = require('express').Router();
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const authService = require('../services/authService');
const { audit } = require('../utils/audit');
const db = require('../config/db');
const schemas = require('../validators/schemas');

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.cookieSameSite,
  path: '/',
});

router.post('/login', loginLimiter, validate(schemas.login), asyncHandler(async (req, res) => {
  const { token, user } = await authService.login(req.body.email, req.body.password, { ip: req.ip });
  res.cookie(env.cookieName, token, { ...cookieOptions(), maxAge: 8 * 60 * 60 * 1000 });
  res.json({ user });
}));

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await audit(db, req.ctx, { action: 'logout', entityType: 'user', entityId: req.user.id });
  res.clearCookie(env.cookieName, cookieOptions());
  res.json({ ok: true });
}));

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

module.exports = router;
