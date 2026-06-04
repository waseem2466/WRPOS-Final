const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: 'C:/Users/wasee/OneDrive/Desktop/wr-pos/.env' });
(async () => {
  const url = process.env.DATABASE_URL;
  console.log('DB URL:', url ? url.substring(0, 40) + '...' : 'NOT FOUND');
  if (!url) { console.log('ERROR: No DATABASE_URL in .env'); process.exit(1); }
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    const r = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position");
    let last = '';
    for (const row of r.rows) {
      if (row.table_name !== last) { console.log('\n=== ' + row.table_name + ' ==='); last = row.table_name; }
      console.log('  ' + row.column_name + ' (' + row.data_type + ')');
    }
    const customers = await pool.query('SELECT COUNT(*) FROM "Customer"');
    console.log('\n=== Customer count: ' + customers.rows[0].count + ' ===');
    if (parseInt(customers.rows[0].count) > 0) {
      const sample = await pool.query('SELECT id, name, phone FROM "Customer" LIMIT 3');
      for (const c of sample.rows) console.log('  ' + c.id + ' | ' + c.name + ' | ' + c.phone);
    }
    await pool.end();
  } catch (e) { console.error('DB Error:', e.message); }
})();
