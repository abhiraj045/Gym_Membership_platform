const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const db = require('./config/db');
const { csrfGuard } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1); // behind a hosting proxy; needed for correct client IPs in rate limiting
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/health', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT NOW() AS db_time');
    res.json({ status: 'ok', dbTime: rows[0].db_time });
  } catch {
    res.status(500).json({ status: 'error', message: 'Database unreachable' });
  }
});

app.use('/api', apiLimiter);
app.use('/api/jobs', require('./routes/jobs.routes')); // secret-header auth, no cookies
app.use('/api', csrfGuard);
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/plans', require('./routes/plans.routes'));
app.use('/api/members', require('./routes/members.routes'));
app.use('/api/memberships', require('./routes/memberships.routes'));
app.use('/api/payments', require('./routes/payments.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/reminders', require('./routes/reminders.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
