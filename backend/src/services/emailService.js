const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
if (env.smtp.host) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

async function sendViaResend({ to, subject, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.emailFrom, to: [to], subject, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (res.ok) return { ok: true };
  let msg = `Resend error ${res.status}`;
  try {
    const j = await res.json();
    if (j.message) msg = `${res.status}: ${j.message}`;
  } catch { /* keep default message */ }
  return { ok: false, error: msg.slice(0, 500) };
}

// Never throws: returns { ok } or { ok:false, error } so callers can record delivery status.
async function send({ to, subject, text }) {
  try {
    if (env.resendApiKey) return await sendViaResend({ to, subject, text });
    if (!transporter) return { ok: false, error: 'No email provider configured' };
    await transporter.sendMail({ from: env.smtp.from || env.smtp.user, to, subject, text });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 500) };
  }
}

module.exports = { send };