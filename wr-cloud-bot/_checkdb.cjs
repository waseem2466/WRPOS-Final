const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const r = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position");
  let last = '';
  for (const row of r.rows) {
    if (row.table_name !== last) { console.log('\n' + row.table_name); last = row.table_name; }
    console.log('  ' + row.column_name + ' (' + row.data_type + ')');
  }
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
