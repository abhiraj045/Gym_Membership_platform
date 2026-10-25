require('dotenv').config();

const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((k) => !process.env[k]);
if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);
if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  dbSsl: process.env.DB_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  cookieName: 'gym_session',
  // Cross-site deployments (frontend and API on different domains) need SameSite=None + Secure.
  cookieSameSite: process.env.COOKIE_SAMESITE || (isProd ? 'none' : 'lax'),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  gymName: process.env.GYM_NAME || 'Gym',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
  },
  enableCron: process.env.ENABLE_CRON === 'true',
  reminderCron: process.env.REMINDER_CRON || '0 9 * * *',
  jobSecret: process.env.JOB_SECRET || '',

  
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || process.env.SMTP_FROM || '',
};
