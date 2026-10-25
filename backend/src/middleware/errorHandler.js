const AppError = require('../utils/AppError');

const notFound = (req, res, next) => next(new AppError(404, 'Route not found'));

// Centralised error handling. Never leaks stack traces or SQL details to the client.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }
  if (err.constraint === 'payments_reference_uq') return res.status(409).json({ error: { message: 'That reference number was already recorded for this member' } });
  if (err.constraint === 'users_email_uq') return res.status(409).json({ error: { message: 'A user with that email already exists' } });
  if (err.code === '23505') return res.status(409).json({ error: { message: 'That value already exists' } });
  if (err.code === '23503') return res.status(409).json({ error: { message: 'This record is referenced by other data' } });
  if (err.code === '23514' || err.code === '22P02') return res.status(400).json({ error: { message: 'Invalid data' } });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { message: 'Malformed JSON' } });

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: { message: 'Internal server error' } });
};

module.exports = { notFound, errorHandler };
