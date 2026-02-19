
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');

async function startTest() {
    console.log('---------------------------------------------------');
    console.log('WR POS - WhatsApp Integration Test');
    console.log('---------------------------------------------------');

    // Use a test auth folder to avoid conflicting with the main app
    const { state, saveCreds } = await useMultiFileAuthState('test_auth_session');

    // Get latest version for reliability
    let version;
    try {
        const result = await fetchLatestBaileysVersion();
        version = result.version;
        console.log(`[Baileys] Using version: ${version.join('.')}`);
    } catch (e) {
        console.log('[Baileys] Falling back to default version');
        version = [2, 3000, 1015901307];
    }

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false, // We will print it ourselves to be safe
        logger: pino({ level: 'error' }),
        browser: ['WR POS Test', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n--- NEW QR CODE RECEIVED ---');
            QRCode.toString(qr, { type: 'terminal', small: true }, (err, url) => {
                console.log(url);
                console.log('Scan this QR code with your WhatsApp to test connection.\n');
            });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('Connection closed, reconnecting...');
                startTest();
            }
        } else if (connection === 'open') {
            console.log('---------------------------------------------------');
            console.log('✅ Connection Opened Successfully!');
            console.log('User JID:', sock.user.id);
            console.log('---------------------------------------------------');

            const recipient = process.argv[2];
            let jid = sock.user.id; // Default to self

            if (recipient) {
                // Formatting: if it's just numbers, add the suffix
                jid = recipient.includes('@') ? recipient : `${recipient.replace('+', '')}@s.whatsapp.net`;
                console.log(`Testing with CUSTOM recipient: ${jid}`);
            } else {
                console.log(`No recipient provided. Testing WITH SELF: ${jid}`);
                console.log(`(Tip: You can pass a number: node scripts/test-whatsapp.js 94719336848)`);
            }

            const msg = '🔔 WR POS Test: WhatsApp QR (Baileys) Message Verified! 🚀';

            console.log(`Attempting to send test message to ${jid}...`);

            try {
                const sentMsg = await sock.sendMessage(jid, { text: msg });
                console.log('✅ Test Message SENT!');
                console.log('Message ID:', sentMsg.key.id);
                console.log('---------------------------------------------------');
                console.log('Test complete. You can press Ctrl+C to exit.');
            } catch (err) {
                console.error('❌ Failed to send test message:', err);
            }
        }
    });
}

startTest();
