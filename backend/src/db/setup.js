// One-step database setup for deployment. Safe to run on EVERY start:
//  - creates all tables only if they do not exist yet
//  - creates the first owner only if no owner exists AND OWNER_EMAIL + OWNER_PASSWORD are set
// Standalone on purpose: it only needs `pg` and `bcryptjs`, and prints every step.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  console.log('[setup] connected to the database');

  const exists = await client.query("SELECT to_regclass('public.users') AS t");
  if (exists.rows[0].t) {
    console.log('[setup] tables already exist: skipping migration');
  } else {
    const sqlPath = path.join(__dirname, 'migrations', '001_init.sql');
    if (!fs.existsSync(sqlPath)) throw new Error(`Missing file: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('[setup] migration applied: all tables created');
    } catch (err) {
      await client.query('ROLLBACK');
      let near = '';
      if (err.position) {
        const pos = Number(err.position);
        near = `\n>>> near: ${sql.slice(Math.max(0, pos - 80), pos + 40)}`;
      }
      throw new Error(`Migration failed: ${err.message}${near}`);
    }
  }

  // Keep the separate `npm run migrate` tool consistent with this setup.
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await client.query("INSERT INTO schema_migrations (filename) VALUES ('001_init.sql') ON CONFLICT DO NOTHING");

  const owner = await client.query("SELECT 1 FROM users WHERE role = 'owner' LIMIT 1");
  const { OWNER_NAME, OWNER_EMAIL, OWNER_PASSWORD } = process.env;
  if (owner.rows.length) {
    console.log('[setup] owner account already exists');
  } else if (OWNER_EMAIL && OWNER_PASSWORD) {
    if (OWNER_PASSWORD.length < 10) throw new Error('OWNER_PASSWORD must be at least 10 characters');
    const hash = await bcrypt.hash(OWNER_PASSWORD, 12);
    await client.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'owner')",
      [OWNER_NAME || 'Gym Owner', OWNER_EMAIL.trim(), hash]
    );
    console.log(`[setup] owner created: ${OWNER_EMAIL.trim()}  (now delete OWNER_PASSWORD from your environment settings)`);
  } else {
    console.log('[setup] NO OWNER YET. Set OWNER_EMAIL and OWNER_PASSWORD in the environment and redeploy.');
  }

  const t = await client.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'");
  console.log(`[setup] done. public tables: ${t.rows[0].n}`);
  await client.end();
}

main().catch((err) => { console.error('[setup] FAILED:', err.message); process.exit(1); });