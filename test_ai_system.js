
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');
const path = require('path');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '.env') });

async function testAI() {
    console.log("--- WR SMILE SUPPLIES: AI SYSTEM TEST ---");
    
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ ERROR: VITE_GEMINI_API_KEY not found in .env");
        return;
    }

    try {
        console.log("1. Testing Google Gemini Connectivity...");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const testPrompt = "You are the AI for WR SMILE SUPPLIES. Say 'Systems Online' and give a 1-sentence professional greeting.";
        const result = await model.generateContent(testPrompt);
        const response = await result.response;
        console.log("   ✅ GEMINI RESPONSE:", response.text().trim());

        console.log("\n2. Testing Database Connectivity (For AI Context)...");
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const dbTest = await pool.query('SELECT COUNT(*) FROM "Customer"');
        console.log(`   ✅ DATABASE: Connected. Found ${dbTest.rows[0].count} customers.`);
        await pool.end();

        console.log("\n3. Verifying WhatsApp Bot Integration...");
        const waToken = process.env.WHATSAPP_TOKEN;
        const waId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        if (waToken && waId) {
            console.log("   ✅ WHATSAPP CLOUD: Credentials Present.");
        } else {
            console.log("   ⚠️ WHATSAPP CLOUD: Credentials missing, bot will use QR Fallback.");
        }

        console.log("\n--- TEST COMPLETE: AI SYSTEM IS FULLY OPERATIONAL ---");
    } catch (error) {
        console.error("\n❌ CRITICAL FAILURE IN AI SYSTEM:");
        console.error(error.message);
    }
}

testAI();
