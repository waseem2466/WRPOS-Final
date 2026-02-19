const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

const logFile = 'health_check_debug.log';
function log(msg) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
}

async function checkAll() {
    try {
        log("Starting health check...");
        if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
        log("Debug log initialized.");

        dotenv.config();
        log("Environment variables loaded.");

        let report = "WR POS HEALTH CHECK REPORT\n";
        report += "==========================\n\n";

        // 1. Database Check
        log("Checking database...");
        report += "--- 1. Database Check ---\n";
        if (!process.env.DATABASE_URL) {
            log("DATABASE_URL is missing!");
            report += "❌ DATABASE_URL is missing!\n";
        } else {
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                connectionTimeoutMillis: 5000
            });
            try {
                log("Executing query...");
                const dbRes = await pool.query('SELECT NOW()');
                report += "✅ Database Connected: " + dbRes.rows[0].now + "\n";
                log("Database query successful.");

                const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
                report += "📚 Tables found: " + tablesRes.rows.map(r => r.table_name).join(', ') + "\n";
            } catch (err) {
                log("Database error: " + err.message);
                report += "❌ Database Error: " + err.message + "\n";
            } finally {
                await pool.end();
                log("Database connection closed.");
            }
        }

        // 2. AI Config Check
        log("Checking AI config...");
        report += "\n--- 2. AI Config Check ---\n";
        report += "Gemini Key: " + (process.env.VITE_GEMINI_API_KEY ? "Present" : "Missing") + "\n";
        report += "DeepSeek Key: " + (process.env.VITE_DEEPSEEK_API_KEY ? "Present" : "Missing") + "\n";

        fs.writeFileSync('system_health_check.txt', report);
        log("Final report written to system_health_check.txt");
    } catch (globalErr) {
        log("FATAL ERROR: " + globalErr.message);
    }
}

checkAll();
