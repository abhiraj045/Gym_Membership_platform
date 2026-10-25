const { Pool, types } = require('pg');
const env = require('./env');

// Return DATE columns as 'YYYY-MM-DD' strings (no timezone surprises).
// NUMERIC already comes back as a string, which is what we want for money.
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

pool.query('SELECT NOW()')
  .then((result) => console.log('Database connected:', result.rows[0]))
  .catch((error) => console.error('Database connection failed:', error.message));

pool.on('error', (err) => console.error('Unexpected PG pool error:', err.message));

const query = (text, params) => pool.query(text, params);

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
