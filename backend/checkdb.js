const { Client } = require('pg');
const c = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
(async () => {
  await c.connect();
  const t = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
  console.log('TABLES:', t.rows.map((r) => r.table_name).join(', ') || '(none)');
  try {
    const u = await c.query('SELECT email, role FROM users');
    console.log('USERS:', u.rows);
  } catch (e) {
    console.log('USERS TABLE PROBLEM:', e.message);
  }
  await c.end();
})().catch((e) => console.log('FAILED:', e.message));