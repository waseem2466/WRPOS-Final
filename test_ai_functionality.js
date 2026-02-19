const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function testAI() {
    console.log("--- WR SMILE SUPPLIES: AI SYSTEM TEST ---");
    
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ ERROR: VITE_GEMINI_API_KEY not found in .env");
        return false;
    }

    try {
        console.log("1. Testing Google Gemini Connectivity...");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const testPrompt = "You are the AI for WR SMILE SUPPLIES. Say 'Systems Online' and give a 1-sentence professional greeting.";
        const result = await model.generateContent(testPrompt);
        const response = await result.response;
        console.log("   ✅ GEMINI RESPONSE:", response.text().trim());

        console.log("\n2. Testing AI Reply Function...");
        const { aiReply } = require('./aiReply.js');
        const reply = await aiReply("Hello, this is a test message", "gemini");
        console.log("   ✅ AI REPLY:", reply);

        console.log("\n--- TEST COMPLETE: AI SYSTEM IS FULLY OPERATIONAL ---");
        return true;
    } catch (error) {
        console.error("\n❌ CRITICAL FAILURE IN AI SYSTEM:");
        console.error(error.message);
        return false;
    }
}

testAI().then(success => {
    process.exit(success ? 0 : 1);
});
