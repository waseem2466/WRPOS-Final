const { GoogleGenerativeAI } = require('@google/generative-ai');

const keys = [
    { name: '.env', key: 'AIzaSyDblUaTrcN8W6ronMWHWSB4nY3_V_9cRBg' },
    { name: '.env.local', key: 'AIzaSyDLfnrn9UJC8g7Y34VXiHq1tUSfEBkmC5Q' },
    { name: 'test-api-key.js Hardcoded', key: 'AIzaSyCKya9NRPcJ9nGuiXq3Tp_G8XDfkkZ4dos' }
];

async function testAll() {
    console.log('🚀 Testing all discovered Gemini API keys...\n');

    for (const item of keys) {
        console.log(`📋 Testing ${item.name}: ${item.key.substring(0, 15)}...`);
        try {
            const genAI = new GoogleGenerativeAI(item.key);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent('Hello, are you working? Respond with "Yes" and your version.');
            const response = await result.response;
            console.log(`✅ SUCCESS:`, response.text().trim());
        } catch (error) {
            console.log(`❌ FAILED:`, error.message);
        }
        console.log('-------------------\n');
    }
}

testAll();
