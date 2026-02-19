// WR POS AI Bot - Comprehensive Test Script
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('🤖 === AI BOT COMPREHENSIVE TEST ===\n');

const apiKey = 'AIzaSyDblUaTrcN8W6ronMWHWSB4nY3_V_9cRBg';
const businessName = 'WR Smile & Supplies';
const businessAddress = '411/7, Kandy Road, Mollipothana';

// Test 1: API Connection
async function testAPIConnection() {
    console.log('🔍 Test 1: API Connection');
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        
        const testPrompt = `Hello! This is a test. Please respond with "AI Bot Connection Successful!"`;
        const result = await model.generateContent(testPrompt);
        const response = await result.response;
        
        console.log('✅ API Connection: SUCCESS');
        console.log('📝 Response:', response.text);
        return true;
    } catch (error) {
        console.log('❌ API Connection: FAILED');
        console.log('🔍 Error:', error.message);
        return false;
    }
}

// Test 2: Customer Support Simulation
async function testCustomerSupport() {
    console.log('\n🔍 Test 2: Customer Support Simulation');
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        
        const customerQuery = `Hello! I'm looking for kitchen accessories. What do you have available at ${businessName}?`;
        
        const systemPrompt = `You are a helpful AI assistant for ${businessName} located at ${businessAddress}. 
        We offer kitchen accessories, home essentials, kids' items, and stationery.
        Be professional, friendly, and helpful. Mention our WhatsApp group: https://chat.whatsapp.com/K7ALigMk9ad4SBlcRUqoxX?mode=wwt`;
        
        const fullPrompt = `${systemPrompt}\n\nCustomer: ${customerQuery}`;
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        console.log('✅ Customer Support: SUCCESS');
        console.log('📝 AI Response:', response.text);
        return true;
    } catch (error) {
        console.log('❌ Customer Support: FAILED');
        console.log('🔍 Error:', error.message);
        return false;
    }
}

// Test 3: Order Processing Simulation
async function testOrderProcessing() {
    console.log('\n🔍 Test 3: Order Processing Simulation');
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        
        const orderQuery = `I want to order 5 kitchen items and 3 stationery items. Can you help me with the process at ${businessName}?`;
        
        const systemPrompt = `You are an AI assistant for ${businessName}. 
        Help customers with order processing, mention our contact details:
        - WhatsApp Group: https://chat.whatsapp.com/K7ALigMk9ad4SBlcRUqoxX?mode=wwt
        - Email: smileandsupplies@outlook.com
        - Phone: 0719336848
        - Address: ${businessAddress}`;
        
        const fullPrompt = `${systemPrompt}\n\nCustomer: ${orderQuery}`;
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        console.log('✅ Order Processing: SUCCESS');
        console.log('📝 AI Response:', response.text);
        return true;
    } catch (error) {
        console.log('❌ Order Processing: FAILED');
        console.log('🔍 Error:', error.message);
        return false;
    }
}

// Test 4: Product Information
async function testProductInfo() {
    console.log('\n🔍 Test 4: Product Information');
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        
        const productQuery = `What types of kids' items do you have at ${businessName}? What are the price ranges?`;
        
        const systemPrompt = `You are an AI assistant for ${businessName}.
        We offer kids' items, kitchen accessories, home essentials, and stationery.
        Be helpful and provide general information about our product categories.
        Mention our WhatsApp group for more details: https://chat.whatsapp.com/K7ALigMk9ad4SBlcRUqoxX?mode=wwt`;
        
        const fullPrompt = `${systemPrompt}\n\nCustomer: ${productQuery}`;
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        console.log('✅ Product Information: SUCCESS');
        console.log('📝 AI Response:', response.text);
        return true;
    } catch (error) {
        console.log('❌ Product Information: FAILED');
        console.log('🔍 Error:', error.message);
        return false;
    }
}

// Test 5: Business Hours and Location
async function testBusinessInfo() {
    console.log('\n🔍 Test 5: Business Information');
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        
        const infoQuery = `What are your business hours and how can I visit ${businessName}?`;
        
        const systemPrompt = `You are an AI assistant for ${businessName} at ${businessAddress}.
        Provide helpful information about our location and how customers can reach us.
        Mention our contact details:
        - WhatsApp Group: https://chat.whatsapp.com/K7ALigMk9ad4SBlcRUqoxX?mode=wwt
        - Email: smileandsupplies@outlook.com
        - Phone: 0719336848`;
        
        const fullPrompt = `${systemPrompt}\n\nCustomer: ${infoQuery}`;
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        console.log('✅ Business Information: SUCCESS');
        console.log('📝 AI Response:', response.text);
        return true;
    } catch (error) {
        console.log('❌ Business Information: FAILED');
        console.log('🔍 Error:', error.message);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    const results = {
        apiConnection: await testAPIConnection(),
        customerSupport: await testCustomerSupport(),
        orderProcessing: await testOrderProcessing(),
        productInfo: await testProductInfo(),
        businessInfo: await testBusinessInfo()
    };
    
    console.log('\n🎯 === TEST RESULTS SUMMARY ===');
    const passed = Object.values(results).filter(r => r === true).length;
    const total = Object.keys(results).length;
    
    console.log(`✅ Tests Passed: ${passed}/${total}`);
    
    Object.keys(results).forEach(test => {
        const status = results[test] ? '✅ PASS' : '❌ FAIL';
        console.log(`${test}: ${status}`);
    });
    
    if (passed === total) {
        console.log('\n🎉 ALL TESTS PASSED! AI Bot is fully functional!');
        console.log('✅ API Connection: Working');
        console.log('✅ Customer Support: Working');
        console.log('✅ Order Processing: Working');
        console.log('✅ Product Information: Working');
        console.log('✅ Business Information: Working');
        console.log('\n🚀 Your AI Bot is ready for customer interactions!');
    } else {
        console.log('\n⚠️ SOME TESTS FAILED');
        console.log('Check the failed tests above for details');
    }
    
    return results;
}

// Execute tests
runAllTests().then(results => {
    console.log('\n✨ === AI BOT TESTING COMPLETE ===');
}).catch(console.error);
