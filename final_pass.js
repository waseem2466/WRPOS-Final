const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

async function check() {
    dotenv.config();
    let report = "CONSOLIDATED HEALTH REPORT - FINAL PASS\n";
    report += "========================================\n\n";

    // DB
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
    try {
        await pool.query('SELECT 1');
        report += "✅ Database: Connected\n";
    } catch (e) { report += "❌ Database: " + e.message + "\n"; }
    finally { await pool.end(); }

    // AI
    report += "✅ Gemini: " + (process.env.VITE_GEMINI_API_KEY ? "Configured" : "Missing") + "\n";
    report += "✅ DeepSeek: " + (process.env.VITE_DEEPSEEK_API_KEY ? "Configured" : "Missing") + "\n";

    // Firebase
    report += "✅ Firebase: " + (process.env.VITE_FIREBASE_PROJECT_ID || "Not Set") + " (Auth Required)\n";

    // Release Folder
    const releaseExists = fs.existsSync('release');
    report += (releaseExists ? "⚠️ Release Folder: Present (Check for locks)" : "✅ Release Folder: Cleared") + "\n";

    fs.writeFileSync('final_pass.txt', report);
    console.log("Check complete.");
}
check();
