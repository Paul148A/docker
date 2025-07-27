const { Pool } = require('pg');

async function waitForPostgres() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123456',
  });
}

module.exports = waitForPostgres;