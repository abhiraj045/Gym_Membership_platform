// For EXTERNAL schedulers (GitHub Actions, cron-job.org). Authenticated by a shared secret header,
// not by a browser cookie, so it is deliberately outside the CSRF-guarded cookie routes.
const crypto = require('crypto');
const router = require('express').Router();
const env = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { loginLimiter } = require('../middleware/rateLimit');
const reminders = require('../services/reminderService');

const safeEqual = (a, b) => {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

router.post('/run-reminders', loginLimiter, asyncHandler(async (req, res) => {
  if (!env.jobSecret) throw new AppError(404, 'Route not found');
  const provided = req.get('x-job-secret') || '';
  if (!safeEqual(provided, env.jobSecret)) throw new AppError(401, 'Invalid job secret');
  res.json(await reminders.run());
}));

module.exports = router;
