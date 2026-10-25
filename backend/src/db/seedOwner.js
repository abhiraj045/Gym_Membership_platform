// Creates the FIRST owner account. Refuses to run if an owner already exists.
// There is no public registration endpoint anywhere in the API.
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function run() {
  const name = process.env.OWNER_NAME || 'Gym Owner';
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) throw new Error('Set OWNER_EMAIL and OWNER_PASSWORD in .env first');
  if (password.length < 10) throw new Error('OWNER_PASSWORD must be at least 10 characters');

  const { rows } = await pool.query("SELECT 1 FROM users WHERE role = 'owner' LIMIT 1");
  if (rows.length) throw new Error('An owner already exists. Aborting.');

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'owner')",
    [name, email.trim(), hash]
  );
  console.log(`Owner created: ${email}. Now remove OWNER_PASSWORD from your .env.`);
}

run().then(() => pool.end()).catch((err) => { console.error(err.message); process.exit(1); });
