// Test Gemini API Key and Get Valid One
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testAndFixAPIKey() {
    console.log('🔍 Testing Gemini API Key...');
    
    // Test the current key
    const currentKey = 'AIzaSyCKya9NRPcJ9nGuiXq3Tp_G8XDfkkZ4dos';
    console.log('📋 Testing key:', currentKey.substring(0, 20) + '...');
    
    try {
        const genAI = new GoogleGenerativeAI(currentKey);
        
        // Test with the simplest model first
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent('Hello, test');
        const response = await result.response;
        const text = response.text();
        
        console.log('✅ SUCCESS! Key is valid');
        console.log('📝 Response:', text.substring(0, 100));
        return { success: true, key: currentKey };
        
    } catch (error) {
        console.log('❌ Current key failed:', error.message);
        
        if (error.message.includes('API_KEY_INVALID')) {
            console.log('\n🔧 API Key Issues:');
            console.log('1. Key may be from wrong project');
            console.log('2. Gemini API not enabled');
            console.log('3. Billing not enabled');
            console.log('4. Key restrictions applied');
            
            console.log('\n📋 To get a valid key:');
            console.log('1. Go to https://aistudio.google.com/app/apikey');
            console.log('2. Create new API key');
            console.log('3. Make sure Gemini API is enabled');
            console.log('4. Copy the new key');
            console.log('5. Update your .env file');
            
            return { 
                success: false, 
                error: 'API_KEY_INVALID',
                message: 'Please get a new API key from AI Studio'
            };
        }
        
        return { success: false, error: error.message };
    }
}

testAndFixAPIKey().then(result => {
    console.log('\n=== FINAL RESULT ===');
    console.log(result);
    
    if (!result.success) {
        console.log('\n🚨 ACTION NEEDED:');
        console.log('1. Visit: https://aistudio.google.com/app/apikey');
        console.log('2. Create new API key');
        console.log('3. Update .env file with: VITE_GEMINI_API_KEY=your_new_key');
        console.log('4. Restart application');
    }
}).catch(console.error);
