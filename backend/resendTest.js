require('dotenv').config();
fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: process.env.EMAIL_FROM,
    to: ['abhirajmulay073@gmail.com'],
    subject: 'Resend test',
    text: 'If you can read this, Resend works.',
  }),
}).then(async (r) => console.log(r.status, await r.text()));