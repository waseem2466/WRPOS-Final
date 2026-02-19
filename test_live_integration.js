const { searchInventory } = require('./dbHelper.js');
const { aiReply } = require('./aiReply.js');

async function testFlow(query) {
    console.log(`\n--- Testing Query: "${query}" ---`);

    // Simulate electron-main logic
    let inventoryContext = '';
    try {
        const products = await searchInventory(query);
        if (products.length > 0) {
            inventoryContext = products.map(p => `- ${p.name}: LKR ${p.price} (Stock: ${p.stock})`).join('\n');
            console.log(`[DB SUCCESS] Found products:\n${inventoryContext}`);
        } else {
            console.log('[DB] No products found in database.');
        }
    } catch (err) {
        console.error('[DB ERROR]', err.message);
    }

    console.log('[AI] Generating reply...');
    const reply = await aiReply(query, 'gemini', inventoryContext);
    console.log(`[BOT REPLY]: ${reply}`);
}

// Test with something likely in a POS or just a general check
testFlow('battery').then(() => testFlow('How much for a screen protector?'));
