// WhatsApp AI Bot Troubleshooting Script
const fs = require('fs');
const path = require('path');

console.log('🔍 === WHATSAPP AI BOT TROUBLESHOOTING ===\n');

// Check key files for WhatsApp AI integration
const checks = [
    {
        file: 'services/whatsapp.ts',
        checks: ['generateReceiptMessage', 'sendBillTemplate', 'GROUP_LINK'],
        description: 'WhatsApp Service - Core Functions'
    },
    {
        file: 'services/whatsAppBotService.ts',
        checks: ['processIncomingMessage', 'generateAiResponse', 'whatsappService'],
        description: 'WhatsApp Bot Service - AI Integration'
    },
    {
        file: 'services/ai.ts',
        checks: ['generateAiContent', 'VITE_GEMINI_API_KEY', 'GoogleGenerativeAI'],
        description: 'AI Service - Gemini Integration'
    },
    {
        file: 'components/WhatsAppBotUI.tsx',
        checks: ['useState', 'useEffect', 'electronAPI', 'Bot'],
        description: 'WhatsApp Bot UI - Interface'
    },
    {
        file: '.env',
        checks: ['VITE_GEMINI_API_KEY', 'AIzaSyDblUaTrcN8W6ronMWHWSB4nY3_V_9cRBg'],
        description: 'Environment - API Key'
    }
];

let allGood = true;

checks.forEach(check => {
    try {
        const filePath = path.join(__dirname, check.file);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            const found = check.checks.filter(c => 
                content.toLowerCase().includes(c.toLowerCase())
            );
            
            const status = found.length === check.checks.length ? '✅ OK' : '⚠️ MISSING';
            const missing = check.checks.filter(c => 
                !content.toLowerCase().includes(c.toLowerCase())
            );
            
            console.log(`${status} ${check.description}`);
            console.log(`   Found: ${found.length}/${check.checks.length}`);
            if (missing.length > 0) {
                console.log(`   Missing: ${missing.join(', ')}`);
                allGood = false;
            }
        } else {
            console.log(`❌ FILE NOT FOUND: ${check.file}`);
            allGood = false;
        }
    } catch (e) {
        console.log(`❌ ERROR checking ${check.file}: ${e.message}`);
        allGood = false;
    }
});

console.log('\n🎯 === TROUBLESHOOTING RESULTS ===');
if (allGood) {
    console.log('✅ All WhatsApp AI components are properly configured');
    console.log('\n📋 Next Steps:');
    console.log('1. Check WhatsApp connection in AI Agent tab');
    console.log('2. Verify QR code scanning works');
    console.log('3. Test with WhatsApp message');
    console.log('4. Check console for AI service logs');
} else {
    console.log('⚠️ Some WhatsApp AI components are missing or misconfigured');
    console.log('\n🔧 Common Issues:');
    console.log('1. API key not loaded properly');
    console.log('2. WhatsApp service not connected');
    console.log('3. AI service not initialized');
    console.log('4. Missing bot service integration');
}

console.log('\n🚀 === TESTING INSTRUCTIONS ===');
console.log('1. Go to AI Agent tab in WR POS');
console.log('2. Click "Connect WhatsApp" button');
console.log('3. Scan QR code with WhatsApp');
console.log('4. Send test message to your WhatsApp');
console.log('5. Check if AI responds automatically');
console.log('6. Look for console logs showing AI responses');

console.log('\n📊 === DEBUG INFO ===');
console.log('If still not working, check:');
console.log('- Browser console for errors');
console.log('- Network tab for API calls');
console.log('- WhatsApp connection status');
console.log('- AI service initialization logs');

console.log('\n✨ === TROUBLESHOOTING COMPLETE ===');
