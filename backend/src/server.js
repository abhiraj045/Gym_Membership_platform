const env = require('./config/env');
const app = require('./app');
const { pool } = require('./config/db');

const server = app.listen(env.port, () => console.log(`API listening on port ${env.port}`));

if (env.enableCron) {
  // Only reliable on an always-on server. On sleeping free hosts use the external /api/jobs endpoint instead.
  const cron = require('node-cron');
  const reminders = require('./services/reminderService');
  cron.schedule(env.reminderCron, () => {
    reminders.run().then((r) => console.log('Reminder run:', r)).catch((e) => console.error('Reminder run failed:', e.message));
  }, { timezone: env.timezone });
  console.log(`Reminder cron scheduled: ${env.reminderCron} (${env.timezone})`);
}

const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
