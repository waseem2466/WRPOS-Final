const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function testDatabase() {
    console.log("--- DATABASE CONNECTIVITY TEST ---");
    
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error("❌ ERROR: DATABASE_URL not found in .env");
        return false;
    }

    try {
        console.log("1. Testing Database Connection...");
        const pool = new Pool({ connectionString: databaseUrl });
        
        // Test basic connection
        const result = await pool.query('SELECT NOW() as current_time, version() as version');
        console.log("   ✅ DATABASE CONNECTED:", result.rows[0].current_time);
        console.log("   ✅ POSTGRES VERSION:", result.rows[0].version.split(',')[0]);

        // Test key tables
        console.log("\n2. Testing Key Tables...");
        const tables = ['Customer', 'Product', 'Bill', 'Expense'];
        for (const table of tables) {
            try {
                const count = await pool.query(`SELECT COUNT(*) as count FROM "${table}"`);
                console.log(`   ✅ ${table}: ${count.rows[0].count} records`);
            } catch (err) {
                console.log(`   ⚠️  ${table}: Table not found or inaccessible`);
            }
        }

        await pool.end();
        console.log("\n--- DATABASE TEST COMPLETE ---");
        return true;
    } catch (error) {
        console.error("\n❌ DATABASE CONNECTION FAILED:");
        console.error(error.message);
        return false;
    }
}

testDatabase().then(success => {
    process.exit(success ? 0 : 1);
});
