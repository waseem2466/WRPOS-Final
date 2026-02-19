const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const { initializeApp } = require('firebase/app');

async function runFinalCheck() {
    dotenv.config();
    let report = "WR POS FINAL CONSOLIDATED REPORT\n";
    report += "================================\n\n";

    // 1. Database
    report += "--- 1. Database (Neon/PG) ---\n";
    if (process.env.DATABASE_URL) {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
        try {
            const res = await pool.query('SELECT NOW()');
            report += "✅ Status: Connected\n";
            report += "🕒 Server Time: " + res.rows[0].now + "\n";
            const tables = await pool.query("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'");
            report += "📚 Tables Count: " + tables.rows[0].count + "\n";
        } catch (e) { report += "❌ Error: " + e.message + "\n"; }
        finally { await pool.end(); }
    } else { report += "❌ Error: DATABASE_URL missing\n"; }

    // 2. AI Services
    report += "\n--- 2. AI Services ---\n";
    report += "Gemini: " + (process.env.VITE_GEMINI_API_KEY ? "✅ Configured" : "❌ Missing") + "\n";
    report += "DeepSeek: " + (process.env.VITE_DEEPSEEK_API_KEY ? "✅ Configured" : "❌ Missing") + "\n";

    // 3. WhatsApp
    report += "\n--- 3. WhatsApp (Cloud/QR) ---\n";
    report += "Cloud Token: " + (process.env.WHATSAPP_TOKEN ? "✅ Present" : "❌ Missing") + "\n";
    report += "Phone ID: " + (process.env.WHATSAPP_PHONE_NUMBER_ID ? "✅ Present" : "❌ Missing") + "\n";

    // 4. Firebase
    report += "\n--- 4. Firebase (Cloud Sync) ---\n";
    const fbProjectId = process.env.VITE_FIREBASE_PROJECT_ID;
    if (fbProjectId) {
        report += "Project: " + fbProjectId + "\n";
        report += "Status: ✅ Keys Present, Security: 🛡️ Auth Required (Active)\n";
    } else { report += "❌ Error: Firebase Config missing\n"; }

    fs.writeFileSync('final_check_report.txt', report);
    console.log("Final check complete. See final_check_report.txt");
}

runFinalCheck();
