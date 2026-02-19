const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    console.log('--- Database Migration v2: Adding Customer.language ---');
    try {
        // Check if column exists
        const checkRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='Customer' AND column_name='language'
        `);

        if (checkRes.rows.length === 0) {
            console.log('Adding "language" column to "Customer" table...');
            await pool.query('ALTER TABLE "Customer" ADD COLUMN "language" TEXT DEFAULT \'en\'');
            console.log('SUCCESS: Column added.');
        } else {
            console.log('Column "language" already exists. Skipping.');
        }

        // Also ensure WhatsAppMessage table exists (rerun v1 logic)
        console.log('Verifying WhatsAppMessage table...');
        const sql = `
            CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
                id TEXT PRIMARY KEY,
                from_number TEXT NOT NULL,
                to_number TEXT,
                text TEXT NOT NULL,
                type TEXT NOT NULL,
                method TEXT NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS "idx_wa_msg_from" ON "WhatsAppMessage"(from_number);
            CREATE INDEX IF NOT EXISTS "idx_wa_msg_ts" ON "WhatsAppMessage"(timestamp DESC);
        `;
        await pool.query(sql);
        console.log('SUCCESS: WhatsAppMessage table verified.');

    } catch (err) {
        console.error('FAILURE:', err.message);
    } finally {
        await pool.end();
    }
}

run();
