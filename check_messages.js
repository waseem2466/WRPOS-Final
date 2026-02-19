const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkMessages() {
    try {
        const res = await pool.query('SELECT * FROM "WhatsAppMessage" ORDER BY timestamp DESC LIMIT 5');
        console.log('--- Latest 5 WhatsApp Messages ---');
        console.table(res.rows);
    } catch (err) {
        console.error('Database Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkMessages();
