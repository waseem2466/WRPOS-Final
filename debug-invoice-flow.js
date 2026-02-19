/**
 * WhatsApp Invoice Flow Debug Script
 * ===================================
 * 
 * Paste these snippets into Electron DevTools Console (Ctrl+Shift+I)
 * to test the full invoice flow step by step.
 * 
 * Replace TARGET_PHONE with your WhatsApp number (country code, no +)
 * Example: '919876543210'
 */

// ========================================
// STEP 1: Check Bot Status
// ========================================
// Paste this first:
/*

window.electronAPI.waGetStatus().then(status => {
    console.log('=== BOT STATUS ===');
    console.log('State:', status.state);
    console.log('QR:', status.qr ? 'Available (not linked yet)' : 'None (good)');
    if (status.state === 'LINKED') {
        console.log('✅ Bot is LINKED and ready to send/receive messages.');
    } else {
        console.log('❌ Bot is NOT linked. State:', status.state);
        console.log('   → Click "Link WhatsApp" to scan QR code first.');
    }
});

*/

// ========================================
// STEP 2: Send a Simple Test Message
// ========================================
// If Step 1 shows LINKED, paste this (change the number!):
/*

const TARGET = '919876543210';
window.electronAPI.waQrSend({ to: TARGET, message: '👋 Hello! This is a test from WR POS bot.' })
  .then(r => {
      if (r) console.log('✅ Test message SENT successfully:', r);
      else console.log('❌ sendMessage returned null — check Electron console for [Baileys] errors');
  })
  .catch(e => console.error('❌ Send FAILED:', e));

*/

// ========================================
// STEP 3: Force an Invoice Send
// ========================================
// This bypasses AI/intent detection and directly sends an invoice:
/*

const TARGET = '919876543210';
const invoiceNum = 'INV-' + Date.now().toString().slice(-6);
const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const invoice = `🧾 *INVOICE #${invoiceNum}* - Date: ${today}

Customer: Valued Customer
Amount Due: *Rs. 0.00*

Payment Options:
• Cash
• Bank Transfer (Account: XXXX-XXXX-XXXX)
• QR Payment (Scan at counter)

Thank you for your business! 🙏`;

console.log('=== SENDING INVOICE ===');
console.log(invoice);

window.electronAPI.waQrSend({ to: TARGET, message: invoice })
  .then(r => {
      if (r) console.log('✅ Invoice SENT via QR Bot!');
      else console.log('❌ Invoice send returned null');
  })
  .catch(e => console.error('❌ Invoice send FAILED:', e));

*/

// ========================================
// STEP 4: Test the Full Auto-Reply Flow
// ========================================
// Send yourself a message saying "send me the bill" from your phone.
// Then check Electron's main process console (not DevTools) for:
//
//   [Baileys Socket] Incoming message from ...
//   [AI] Generating Invoice for ...
//   [AI] Sending Invoice: ...
//
// If you see "[Baileys] Cannot send message: not connected" → re-link
// If you see "[DB] Msg Save Fail:" → database credentials are wrong
// If you see nothing → the message isn't reaching the bot

console.log('📋 Debug script loaded. Open this file to see paste-able snippets.');
