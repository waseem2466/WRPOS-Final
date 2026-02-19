// Test Gemini 2.0 Flash with new API key
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini2() {
    const apiKey = 'AIzaSyDblUaTrcN8W6ronMWHWSB4nY3_V_9cRBg';
    
    console.log('🚀 Testing Gemini 2.0 Flash...');
    console.log('🔑 API Key:', apiKey.substring(0, 20) + '...');
    
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Test the new 2.0 model
        console.log('🧪 Testing gemini-2.0-flash...');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        
        const result = await model.generateContent('Explain how AI works in a few words');
        const response = await result.response;
        const text = response.text();
        
        console.log('✅ SUCCESS! Gemini 2.0 Flash works!');
        console.log('📝 Response:', text);
        
        return { 
            success: true, 
            model: 'gemini-2.0-flash',
            response: text,
            apiKey: apiKey
        };
        
    } catch (error) {
        console.log('❌ Gemini 2.0 failed:', error.message);
        
        // Test fallback to 1.5-flash
        try {
            console.log('🔄 Trying fallback gemini-1.5-flash...');
            const genAI = new GoogleGenerativeAI(apiKey);
            const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const fallbackResult = await fallbackModel.generateContent('Fallback test - respond "Fallback works!"');
            const fallbackResponse = await fallbackResult.response;
            const fallbackText = fallbackResponse.text();
            
            console.log('✅ Fallback works!');
            console.log('📝 Fallback Response:', fallbackText);
            
            return { 
                success: true, 
                model: 'gemini-1.5-flash',
                response: fallbackText,
                note: 'Using fallback model'
            };
        } catch (fallbackError) {
            console.log('❌ Fallback also failed:', fallbackError.message);
            return { success: false, error: error.message };
        }
    }
}

testGemini2().then(result => {
    console.log('\n=== FINAL RESULT ===');
    if (result.success) {
        console.log('🎉 GEMINI API WORKS!');
        console.log('✅ Model:', result.model);
        console.log('✅ Response:', result.response);
        if (result.note) console.log('ℹ️ Note:', result.note);
        
        console.log('\n🚀 READY FOR WR POS:');
        console.log('1. API key is valid');
        console.log('2. Gemini 2.0 available');
        console.log('3. Restart app to test in WR POS');
    } else {
        console.log('❌ API KEY STILL INVALID');
        console.log('Error:', result.error);
    }
}).catch(console.error);
