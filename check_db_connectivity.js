const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const connectionString = process.env.DATABASE_URL;
const resultsFile = path.join(__dirname, 'db_check_results.txt');

function logResult(msg) {
    console.log(msg);
    fs.appendFileSync(resultsFile, msg + '\n');
}

if (fs.existsSync(resultsFile)) fs.unlinkSync(resultsFile);

async function checkDb() {
    logResult('🔍 Checking Database Connectivity (Neon)...');
    logResult('Connection URL present: ' + (!!connectionString));

    if (!connectionString) {
        logResult('❌ DATABASE_URL is missing in .env');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString,
        ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000
    });

    try {
        logResult('📡 Attempting to connect...');
        const client = await pool.connect();
        logResult('✅ Connected to Postgres successfully!');

        const res = await client.query('SELECT current_database(), current_user, version()');
        logResult('📊 Connection Info:');
        logResult('   Database: ' + res.rows[0].current_database);
        logResult('   User: ' + res.rows[0].current_user);

        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
        `);

        logResult('\n📁 Tables found in "public" schema:');
        if (tablesRes.rows.length === 0) {
            logResult('   (No tables found)');
        } else {
            for (const row of tablesRes.rows) {
                try {
                    const countRes = await client.query(`SELECT COUNT(*) as count FROM "${row.table_name}"`);
                    logResult(`   - ${row.table_name}: ${countRes.rows[0].count} records`);
                } catch (e) {
                    logResult(`   - ${row.table_name}: (Could not read count: ${e.message})`);
                }
            }
        }

        client.release();
    } catch (err) {
        logResult('❌ Database Connection Failed: ' + err.message);
    } finally {
        await pool.end();
        logResult('\n=== Done ===');
    }
}

checkDb();
