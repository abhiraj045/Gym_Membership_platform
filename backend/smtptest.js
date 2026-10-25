require('dotenv').config();
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
t.sendMail({
  from: process.env.SMTP_FROM || process.env.SMTP_USER,
  to: process.env.SMTP_USER,
  subject: 'SMTP test',
  text: 'If you can read this, SMTP works.',
}).then(() => console.log('SENT OK')).catch((e) => console.log('FAILED:', e.message));