const rateLimit = require('express-rate-limit');

const json429 = { error: { message: 'Too many requests. Please try again later.' } };

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: json429 });

// Brute-force protection for login (in addition to per-account lockout in authService).
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: json429 });

module.exports = { apiLimiter, loginLimiter };
