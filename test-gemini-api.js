// Test Gemini API Key
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiAPI() {
    const apiKey = 'AIzaSyCKya9NRPcJ9nGuiXq3Tp_G8XDfkkZ4dos';
    
    console.log('Testing Gemini API with key:', apiKey.substring(0, 20) + '...');
    
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Try to list available models first
        console.log('Testing API connection...');
        
        // Try different models
        const models = [
            'gemini-1.5-flash',
            'gemini-1.5-pro', 
            'gemini-pro',
            'gemini-1.0-pro',
            'gemini-pro-latest'
        ];
        
        for (const modelName of models) {
            try {
                console.log(`Trying model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent('Hello, just testing');
                const response = await result.response;
                const text = response.text();
                
                console.log(`✅ SUCCESS with ${modelName}:`, text.substring(0, 100));
                return { success: true, model: modelName, response: text };
                break;
            } catch (modelError) {
                console.log(`❌ FAILED ${modelName}:`, modelError.message);
                continue;
            }
        }
        
        console.log('❌ All models failed');
        return { success: false, error: 'No working models found' };
        
    } catch (error) {
        console.error('❌ API Test Failed:', error.message);
        return { success: false, error: error.message };
    }
}

testGeminiAPI().then(result => {
    console.log('\n=== FINAL RESULT ===');
    console.log(result);
}).catch(console.error);
