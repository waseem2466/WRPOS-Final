// Test New Gemini API Key
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testNewAPIKey() {
    const newKey = 'AIzaSyDblUaTrcN8W6ronMWHWSB4nY3_V_9cRBg';
    
    console.log('🔑 Testing NEW API Key:', newKey.substring(0, 20) + '...');
    
    try {
        const genAI = new GoogleGenerativeAI(newKey);
        
        // Test with gemini-1.5-flash (most stable)
        console.log('🧪 Testing with gemini-1.5-flash...');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const result = await model.generateContent('Hello! This is a test. Please respond with "API key is working!"');
        const response = await result.response;
        const text = response.text();
        
        console.log('✅ SUCCESS! New API key works perfectly!');
        console.log('📝 Response:', text);
        
        // Test with gemini-pro as backup
        console.log('\n🔄 Testing backup model gemini-pro...');
        const backupModel = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const backupResult = await backupModel.generateContent('Backup test - respond "Backup works!"');
        const backupResponse = await backupResult.response;
        const backupText = backupResponse.text();
        
        console.log('✅ Backup model also works!');
        console.log('📝 Backup Response:', backupText);
        
        return { 
            success: true, 
            key: newKey,
            primaryModel: 'gemini-1.5-flash',
            backupModel: 'gemini-pro'
        };
        
    } catch (error) {
        console.log('❌ New key failed:', error.message);
        return { success: false, error: error.message };
    }
}

testNewAPIKey().then(result => {
    console.log('\n=== FINAL RESULT ===');
    if (result.success) {
        console.log('🎉 API KEY IS VALID!');
        console.log('✅ Primary Model:', result.primaryModel);
        console.log('✅ Backup Model:', result.backupModel);
        console.log('\n🚀 READY TO USE:');
        console.log('1. Replace your .env file with .env.new');
        console.log('2. Restart: npm run electron:dev');
        console.log('3. Test AI in Dashboard');
    } else {
        console.log('❌ API KEY STILL INVALID');
        console.log('Please get another key from: https://aistudio.google.com/app/apikey');
    }
}).catch(console.error);
