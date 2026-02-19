const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function discover() {
    try {
        const res = await pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
        `);

        let output = "=== Database Schema Discovery ===\n\n";
        let currentTable = "";

        res.rows.forEach(row => {
            if (row.table_name !== currentTable) {
                currentTable = row.table_name;
                output += `\nTABLE: ${currentTable}\n`;
            }
            output += `  - ${row.column_name} (${row.data_type})\n`;
        });

        fs.writeFileSync('schema_discovery.txt', output);
        console.log('✅ Schema discovery complete. See schema_discovery.txt');
        process.exit(0);
    } catch (err) {
        console.error('❌ Discovery failed:', err.message);
        process.exit(1);
    }
}
discover();
