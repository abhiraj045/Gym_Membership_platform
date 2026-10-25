const db = require('../config/db');
const env = require('../config/env');
const { today } = require('../utils/dates');
const { audit } = require('../utils/audit');
const email = require('./emailService');
const dashboard = require('./dashboardService');

async function getSettings() {
  const { rows } = await db.query('SELECT days_before, days_after, send_owner_summary FROM reminder_settings WHERE id = 1');
  return rows[0];
}

async function updateSettings(body, ctx) {
  return db.withTransaction(async (c) => {
    const old = (await c.query('SELECT * FROM reminder_settings WHERE id = 1')).rows[0];
    const { rows } = await c.query(
      `UPDATE reminder_settings SET days_before = $1, days_after = $2, send_owner_summary = $3, updated_at = now()
       WHERE id = 1 RETURNING days_before, days_after, send_owner_summary`,
      [[...new Set(body.days_before)], [...new Set(body.days_after)], body.send_owner_summary]
    );
    await audit(c, ctx, { action: 'reminder_settings_update', entityType: 'settings', entityId: 1, oldValues: old, newValues: rows[0] });
    return rows[0];
  });
}


// Sends one email and records the outcome on the notification row. Never leaves a row stuck in 'pending'.
async function deliver(notificationId, { to, subject, text }) {
  let r;
  try {
    r = await email.send({ to, subject, text });
  } catch (err) {
    r = { ok: false, error: String(err.message || err).slice(0, 500) };
  }
  await db.query(
    `UPDATE notifications SET status = $2::varchar, sent_at = CASE WHEN $2::varchar = 'sent' THEN now() END,
            error_message = $3::text WHERE id = $1`,
    [notificationId, r.ok ? 'sent' : 'failed', r.ok ? null : r.error]
  );
  return r.ok;
}

function memberMessage(row) {
  const when = row.kind === 'upcoming'
    ? `is due on ${row.due_date}`
    : `was due on ${row.due_date} and is now overdue`;
  return {
    subject: row.kind === 'upcoming' ? `${env.gymName}: fee reminder` : `${env.gymName}: overdue fee`,
    text: `Hello ${row.full_name},\n\nYour membership fee of ${row.balance} for the period starting ${row.period_start} ${when}.\n` +
      `Please pay at the front desk or contact us if you have already paid.\n\nThank you,\n${env.gymName}`,
  };
}

// Safe to run any number of times per day: the unique indexes on `notifications`
// guarantee a given reminder (period + type + date) is claimed and sent only once.
async function run() {
  const t = today();
  const settings = await getSettings();
  const result = { date: t, sent: 0, failed: 0, skipped_duplicates: 0 };

  const { rows: due } = await db.query(
    `SELECT b.billing_period_id, b.member_id, b.balance, b.due_date, b.period_start,
            m.full_name, m.email,
            CASE WHEN b.due_date >= $1::date THEN 'upcoming' ELSE 'overdue' END AS kind
     FROM v_billing_balances b JOIN members m ON m.id = b.member_id
     WHERE b.balance > 0 AND b.membership_status = 'active' AND m.status = 'active' AND m.email IS NOT NULL
       AND ( (b.due_date - $1::date) = ANY($2::int[]) OR ($1::date - b.due_date) = ANY($3::int[]) )`,
    [t, settings.days_before, settings.days_after]
  );

  for (const row of due) {
    const claim = await db.query(
      `INSERT INTO notifications (member_id, billing_period_id, type, recipient, scheduled_for, status)
       VALUES ($1, $2, $3, $4, $5::date, 'pending') ON CONFLICT DO NOTHING RETURNING id`,
      [row.member_id, row.billing_period_id, row.kind, row.email, t]
    );
    if (!claim.rows.length) { result.skipped_duplicates++; continue; }

    const msg = memberMessage(row);
    (await deliver(claim.rows[0].id, { to: row.email, ...msg })) ? result.sent++ : result.failed++;
  }

  await retryFailedToday(t, result);
  if (settings.send_owner_summary) await sendOwnerSummary(t, result);
  return result;
}

async function sendOwnerSummary(t, result) {
  const { rows: owners } = await db.query("SELECT email FROM users WHERE role = 'owner' AND is_active = TRUE");
  const s = await dashboard.summary();
  const text =
    `${env.gymName} daily summary for ${t}\n\n` +
    `Active members: ${s.active_members}\nMemberships expiring in 14 days: ${s.expiring_soon}\n` +
    `Collected this month: ${s.collected_this_month}\nOutstanding: ${s.outstanding}\n` +
    `Overdue: ${s.overdue_amount} (${s.overdue_members} members)\n\n` +
    `Member reminders today: ${result.sent} sent, ${result.failed} failed.`;

  for (const o of owners) {
    const claim = await db.query(
      `INSERT INTO notifications (type, recipient, scheduled_for, status) VALUES ('owner_summary', $1, $2::date, 'pending')
       ON CONFLICT DO NOTHING RETURNING id`, [o.email, t]);
    if (!claim.rows.length) continue;
    await deliver(claim.rows[0].id, { to: o.email, subject: `${env.gymName}: daily summary`, text });
  }
}

// A failed send keeps its row (so the error is visible and the reminder is not duplicated).
// Running the job again the same day retries those rows, as long as the fee is still unpaid.
async function retryFailedToday(t, result) {
  const { rows } = await db.query(
    `SELECT n.id, n.recipient, n.type AS kind, b.due_date, b.period_start, b.balance, m.full_name
     FROM notifications n
     JOIN v_billing_balances b ON b.billing_period_id = n.billing_period_id
     JOIN members m ON m.id = n.member_id
     WHERE n.status = 'failed' AND n.scheduled_for = $1::date AND b.balance > 0`, [t]);
  for (const row of rows) {
    const msg = memberMessage(row);
    if (await deliver(row.id, { to: row.recipient, ...msg })) { result.sent++; result.retried_ok = (result.retried_ok || 0) + 1; }
  }
}

async function listNotifications({ page, limit }) {
  const { rows } = await db.query(
    `SELECT n.*, m.full_name, COUNT(*) OVER() AS total_count FROM notifications n
     LEFT JOIN members m ON m.id = n.member_id ORDER BY n.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, (page - 1) * limit]);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return { data: rows.map(({ total_count, ...r }) => r), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

module.exports = { getSettings, updateSettings, run, listNotifications };
