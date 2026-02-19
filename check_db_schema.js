const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_WnX4hLFdCV1l@ep-muddy-bush-aeihyvce-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function check() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='Customer'");
        const columns = res.rows.map(r => r.column_name);
        fs.writeFileSync('db_check.txt', 'COLUMNS: ' + columns.join(', '));
        process.exit(0);
    } catch (err) {
        fs.writeFileSync('db_check.txt', 'ERROR: ' + err.message);
        process.exit(1);
    }
}
check();
