// WR POS - Complete File Change Verification
const fs = require('fs');
const path = require('path');

console.log('🔍 === COMPLETE FILE CHANGE VERIFICATION ===\n');

// Check all key files that should have been updated
const filesToCheck = [
    {
        path: 'services/whatsapp.ts',
        expectedChanges: ['WhatsApp group link', 'WR Smile & Supplies', 'smileandsupplies@outlook.com'],
        description: 'WhatsApp Service - Business Info'
    },
    {
        path: 'services/ai.ts', 
        expectedChanges: ['gemini-2.0-flash', 'fallback', 'GoogleGenerativeAI'],
        description: 'AI Service - Enhanced with fallbacks'
    },
    {
        path: 'App.tsx',
        expectedChanges: ['isSidebarCollapsed', 'w-0', 'md:ml-0', 'toggle button'],
        description: 'App.tsx - Collapsible Navigation'
    },
    {
        path: 'services/mockDb.ts',
        expectedChanges: ['WR Smile & Supplies', '411/7, Kandy Road, Mollipothana'],
        description: 'Database - Business Information'
    },
    {
        path: 'components/BillingPOS.tsx',
        expectedChanges: ['type="number"', 'onChange', 'min="0"', 'step="1"'],
        description: 'Billing - Manual Quantity Input'
    },
    {
        path: 'BUSINESS_PROFILE.md',
        expectedChanges: ['WR Smile & Supplies', '411/7, Kandy Road', 'smileandsupplies@outlook.com'],
        description: 'Business Profile - Updated Info'
    },
    {
        path: '.env',
        expectedChanges: ['AIzaSyDblUaTrcN8W6ronMWHWSB4nY3_V_9cRBg'],
        description: 'Environment - API Key'
    },
    {
        path: 'vite.config.ts',
        expectedChanges: ['VITE_GEMINI_API_KEY', 'JSON.stringify'],
        description: 'Vite Config - Environment Mapping'
    }
];

let allChangesFound = true;
let results = [];

filesToCheck.forEach(file => {
    try {
        const filePath = path.join(__dirname, file.path);
        if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const foundChanges = file.expectedChanges.filter(change => 
                        content.toLowerCase().includes(change.toLowerCase())
                );
                
                const status = foundChanges.length === file.expectedChanges.length ? '✅ COMPLETE' : '⚠️ PARTIAL';
                const missingChanges = file.expectedChanges.filter(change => 
                        !content.toLowerCase().includes(change.toLowerCase())
                );
                
                results.push({
                        file: file.description,
                        status: status,
                        found: foundChanges.length,
                        total: file.expectedChanges.length,
                        missing: missingChanges
                });
                
                if (foundChanges.length !== file.expectedChanges.length) {
                        allChangesFound = false;
                }
                
                console.log(`📁 ${file.description}: ${status}`);
                console.log(`   Found: ${foundChanges.length}/${file.expectedChanges.length} changes`);
                if (missingChanges.length > 0) {
                        console.log(`   Missing: ${missingChanges.join(', ')}`);
                }
        } else {
                results.push({
                        file: file.description,
                        status: '❌ FILE NOT FOUND',
                        found: 0,
                        total: file.expectedChanges.length,
                        missing: file.expectedChanges
                });
                allChangesFound = false;
                console.log(`❌ ${file.description}: FILE NOT FOUND`);
        }
});

console.log('\n🎯 === VERIFICATION RESULTS ===');
if (allChangesFound) {
        console.log('🎉 ALL CHANGES SUCCESSFULLY APPLIED!');
        console.log('✅ All files have been updated correctly');
        console.log('✅ Your WR POS should show all new features');
        console.log('\n📋 What you should see:');
        console.log('• Collapsible navigation bar with toggle button');
        console.log('• AI bot responding with your business information');
        console.log('• Manual quantity input in billing');
        console.log('• WhatsApp bills with your shop details');
        console.log('• All business information updated');
} else {
        console.log('⚠️ SOME CHANGES MISSING OR NOT APPLIED');
        console.log('❌ Not all files have been updated correctly');
        console.log('\n🔧 POSSIBLE REASONS:');
        console.log('1. Files were not saved properly');
        console.log('2. Application needs to be restarted');
        console.log('3. Browser cache needs to be cleared');
        console.log('4. Development server needs hard restart');
        console.log('\n📝 DETAILED RESULTS:');
        results.forEach(result => {
                console.log(`\n${result.status} ${result.file}`);
                console.log(`   Changes: ${result.found}/${result.total}`);
                if (result.missing.length > 0) {
                        console.log(`   Missing: ${result.missing.join(', ')}`);
                }
        });
}

console.log('\n🚀 === NEXT STEPS ===');
if (allChangesFound) {
        console.log('1. Clear browser cache (Ctrl+Shift+Delete)');
        console.log('2. Hard restart application (Ctrl+C, then npm run electron:dev)');
        console.log('3. Test all features one by one');
} else {
        console.log('1. Check which files are missing changes');
        console.log('2. Re-apply missing changes');
        console.log('3. Restart application after fixes');
}

console.log('\n✨ === VERIFICATION COMPLETE ===');
