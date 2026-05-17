const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', '..', 'wr-cloud-bot');

console.log('Creating Cloud WhatsApp Bot directory at:', targetDir);
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);

// 1. Copy dependencies
const filesToCopy = [
    'aiReply.cjs',
    'groupWatcher.cjs',
    'inventoryManager.cjs',
    'shopData.cjs',
    'intent.cjs'
];

filesToCopy.forEach(file => {
    fs.copyFileSync(path.join(__dirname, '..', file), path.join(targetDir, file));
    console.log(`Copied ${file}`);
});

// 2. Create package.json
const packageJson = {
    name: "wr-cloud-whatsapp-bot",
    version: "1.0.0",
    description: "Standalone WhatsApp AI Bot for WR POS",
    main: "server.js",
    scripts: {
        "start": "node server.js"
    },
    dependencies: {
        "@whiskeysockets/baileys": "^6.7.5",
        "qrcode-terminal": "^0.12.0",
        "dotenv": "^16.4.5",
        "pino": "^9.0.0",
        "node-fetch": "^2.7.0",
        "pg": "^8.11.5"
    }
};
fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(packageJson, null, 2));

// 3. Create server.js (The entry point)
const serverJs = `
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const { handleOwnerCommand, isOwner } = require('./inventoryManager.cjs');
const { handleGroupMessage, isWatchedGroup, registerGroup } = require('./groupWatcher.cjs');
const { aiReply } = require('./aiReply.cjs');
const { detectIntent } = require('./intent.cjs');

async function connectToWhatsApp() {
    console.log('Starting WR POS Cloud WhatsApp Bot...');
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['WR POS Cloud', 'Chrome', '1.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('\\n=========================================');
            console.log('📲 SCAN THIS QR CODE WITH WHATSAPP 📲');
            console.log('=========================================\\n');
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ Connected to WhatsApp successfully!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        for (const msg of messages) {
            if (msg.key.fromMe) continue;
            
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '';
            if (!text) continue;

            const isGroup = msg.key.remoteJid?.endsWith('@g.us');
            const senderJid = isGroup ? (msg.key.participant || msg.key.remoteJid) : msg.key.remoteJid;
            const replyTo = msg.key.remoteJid;
            
            console.log(\`[Message] from \${senderJid}: "\${text}"\`);

            // 1. Handle Owner Commands
            if (isOwner(senderJid)) {
                const intent = detectIntent(text);
                if (intent.startsWith('OWNER_')) {
                    const result = await handleOwnerCommand(senderJid, text);
                    if (result.handled && result.reply) {
                        await sock.sendMessage(replyTo, { text: result.reply }, { quoted: msg });
                        continue;
                    }
                }
            }

            // 2. Ignore Admins
            const adminNumbers = ['0779336848', '0719336848', '0750204698'];
            const isFromAdmin = adminNumbers.some(num => senderJid && senderJid.includes(num));
            if (isFromAdmin) continue;

            // 3. Handle Group Watcher (auto-logging items)
            if (isGroup && isWatchedGroup(msg.key.remoteJid, msg.pushName)) {
                const groupResult = await handleGroupMessage(msg, sock);
                if (groupResult.handled && groupResult.reply) {
                    await sock.sendMessage(replyTo, { text: groupResult.reply });
                    continue;
                }
            }

            // 4. Handle Customer AI Auto-Reply
            const intent = detectIntent(text);
            const aiResponse = await aiReply(text, senderJid, intent);
            if (aiResponse) {
                await sock.sendMessage(replyTo, { text: aiResponse });
            }
        }
    });
}

connectToWhatsApp();
`;
fs.writeFileSync(path.join(targetDir, 'server.js'), serverJs);

// 4. Create .env template
const envTemplate = `
# WR POS Cloud Bot Environment Variables
# MUST USE POSTGRES FOR CLOUD
WRPOS_DB_DRIVER=postgres
DATABASE_URL=your_neon_db_url_here

# AI Keys
GEMINI_API_KEY=your_gemini_key_here
VITE_GEMINI_MODEL=gemini-2.0-flash-lite

# Owner Configuration
OWNER_PHONE=0719336848
WATCHED_GROUPS=smile and supplies
`;
fs.writeFileSync(path.join(targetDir, '.env.example'), envTemplate);

console.log('\\n✅ Cloud Bot extraction complete!');
console.log('The bot is ready at:', targetDir);
