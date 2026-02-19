/**
 * Manual Invoice Send Test via QR Bot (Baileys)
 * 
 * Usage (from Electron dev tools console or as a preload script):
 *   1. Make sure the bot is LINKED (state === 'LINKED')
 *   2. Replace TARGET_PHONE with the WhatsApp number you want to send to
 *   3. Run: node test-invoice-send.js   (won't work standalone — needs Electron context)
 *      OR paste the IPC call below into the Electron DevTools console.
 * 
 * --- Option A: Use from Electron DevTools Console ---
 * Paste this into the app's DevTools console (Ctrl+Shift+I):
 */

// === PASTE THIS IN DEVTOOLS CONSOLE ===
// Replace '919876543210' with the actual WhatsApp number (with country code, no +)
/*

const TARGET_PHONE = '919876543210';

const invoice = `
🧾 *INVOICE #TEST-${Date.now().toString().slice(-6)}* - Date: ${new Date().toLocaleDateString()}

Customer: Test Customer
Amount Due: *Rs. 999*

Payment Options:
• Cash
• Bank Transfer (Account: XXXX-XXXX-XXXX)
• QR Payment (Scan at counter)

Thank you for your business! 🙏
`;

// Send via QR Bot (Baileys)
window.electronAPI.waQrSend({ to: TARGET_PHONE, message: invoice })
  .then(r => console.log('✅ Invoice sent via QR:', r))
  .catch(e => console.error('❌ QR send failed:', e));

// OR Send via Cloud API
window.electronAPI.waCloudSend({ to: TARGET_PHONE, message: invoice })
  .then(r => console.log('✅ Invoice sent via Cloud:', r))
  .catch(e => console.error('❌ Cloud send failed:', e));

*/

// === Option B: Check bot status first ===
/*
window.electronAPI.waGetStatus()
  .then(s => console.log('Bot status:', s));
*/

console.log(`
╔══════════════════════════════════════════════════╗
║  MANUAL INVOICE SEND TEST                        ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  This file contains snippets to paste into the   ║
║  Electron DevTools Console (Ctrl+Shift+I).       ║
║                                                  ║
║  Steps:                                          ║
║  1. Open DevTools in the running app             ║
║  2. Check bot status:                            ║
║     window.electronAPI.waGetStatus()             ║
║       .then(s => console.log(s))                 ║
║                                                  ║
║  3. If state is "LINKED", paste the invoice      ║
║     send snippet from this file.                 ║
║                                                  ║
║  4. Replace TARGET_PHONE with a real number.     ║
║                                                  ║
╚══════════════════════════════════════════════════╝
`);
