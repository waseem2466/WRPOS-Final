const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const connectionString = process.env.DATABASE_URL;
console.log('Using Connection String:', connectionString ? 'PRESENT' : 'MISSING');

const pool = new Pool({ connectionString });

async function check() {
    const logFile = path.join(__dirname, 'db_diag.log');
    const log = (msg) => {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    };

    fs.writeFileSync(logFile, '--- DB DIAGNOSTIC START ---\n');

    try {
        log('Attempting to connect...');
        const client = await pool.connect();
        log('Connected successfully.');

        log('Checking "Customer" table columns...');
        const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='Customer'");
        const columns = res.rows.map(r => r.column_name);
        log('Columns found: ' + columns.join(', '));

        if (!columns.includes('language')) {
            log('Column "language" is MISSING. Attempting to add...');
            await client.query('ALTER TABLE "Customer" ADD COLUMN "language" TEXT DEFAULT \'en\'');
            log('SUCCESS: Column added.');
        } else {
            log('Column "language" is already present.');
        }

        client.release();
    } catch (e) {
        log('ERROR: ' + e.message);
        if (e.stack) log(e.stack);
    } finally {
        await pool.end();
        log('--- DB DIAGNOSTIC END ---');
    }
}

check();
