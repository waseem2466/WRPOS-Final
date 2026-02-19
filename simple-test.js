// Simple API Test
console.log('Testing API key...');

const apiKey = 'AIzaSyCKya9NRPcJ9nGuiXq3Tp_G8XDfkkZ4dos';
console.log('Key:', apiKey.substring(0, 10) + '...');

// Test if we can import the library
try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    console.log('✅ Library imported successfully');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Client created successfully');
    
    // Test with a simple model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('✅ Model instance created');
    
} catch (error) {
    console.log('❌ Error:', error.message);
}
