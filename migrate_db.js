const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    const sql = fs.readFileSync(path.join(__dirname, 'create_whatsapp_table.sql'), 'utf8');
    console.log('Running SQL...');
    try {
        await pool.query(sql);
        console.log('SUCCESS: Table created.');
    } catch (err) {
        console.error('FAILURE:', err.message);
    } finally {
        await pool.end();
    }
}

run();
