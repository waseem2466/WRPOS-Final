const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const pino = require('pino');
const fetch = require('node-fetch');
global.fetch = fetch; // Ensure global fetch is available for modules like aiReply.js
const crypto = require('crypto');
const shop = require('./shopData.js');
const { searchInventory, searchCustomer } = require('./dbHelper.js');

// 1. Initial Configuration
dotenv.config();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const configPath = path.join(DATA_DIR, 'bot_config.json');
let botConfig = { isBotEnabled: true, aiProvider: 'gemini' };

function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            botConfig = { ...botConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
            console.log('[Config] Loaded bot configuration:', botConfig);
        }
    } catch (e) {
        console.error('[Config] Failed to load config:', e.message);
    }
}
function saveConfig() {
    try {
        fs.writeFileSync(configPath, JSON.stringify(botConfig, null, 2));
    } catch (e) {
        console.error('[Config] Failed to save config:', e.message);
    }
}
loadConfig();

// 2. ESM Modules Loader (Baileys)
let makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion;
let aiReply, detectIntent, generateInvoice;

async function loadModules() {
    try {
        const pkgBaileys = await import('@whiskeysockets/baileys');
        makeWASocket = pkgBaileys.default?.default || pkgBaileys.default;
        useMultiFileAuthState = pkgBaileys.useMultiFileAuthState;
        DisconnectReason = pkgBaileys.DisconnectReason;
        Browsers = pkgBaileys.Browsers;
        fetchLatestBaileysVersion = pkgBaileys.fetchLatestBaileysVersion;

        aiReply = require('./aiReply.js').aiReply;
        detectIntent = require('./intent.js').detectIntent;
        generateInvoice = require('./invoice.js').generateInvoice;
        console.log('[System] All modules loaded successfully.');
    } catch (e) {
        console.error('[System] Module load failed:', e.message);
        process.exit(1);
    }
}

// 3. Database Utility
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

function ensureSafeUTF8(text) {
    if (!text) return '';
    return Buffer.from(text, 'utf-8').toString('utf-8');
}

async function saveWhatsAppMessage({ id, from, to, text, type, method }) {
    try {
        await pool.query(
            `INSERT INTO "WhatsAppMessage" (id, from_number, to_number, text, type, method, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
            [id || `msg_${Date.now()}`, from, to, ensureSafeUTF8(text), type, method, new Date()]
        );
    } catch (e) { console.error('[DB] Msg Save Fail:', e.message); }
}

async function addCustomerTag(phone, tag) {
    try {
        await pool.query(
            `UPDATE "Customer" SET tags = array_append(COALESCE(tags, '{}'), $2)
             WHERE phone = $1 AND NOT ($2 = ANY(COALESCE(tags, '{}')))`,
            [phone, tag]
        );
    } catch (e) { console.error('[CRM] Tag Fail:', e.message); }
}

// 4. Webhook Server Logic
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'online', botEnabled: botConfig.isBotEnabled }));

app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) res.status(200).send(challenge);
    else res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
    const entry = req.body.entry?.[0];
    const msg = entry?.changes?.[0]?.value?.messages?.[0];
    if (!msg || !botConfig.isBotEnabled) return res.sendStatus(200);

    const text = msg.text?.body || '';
    const from = msg.from;

    console.log(`[Cloud] Received: "${text}" from ${from}`);

    // Intent & AI Logic
    const intent = detectIntent(text);
    let tag = (intent === 'INVOICE' || intent === 'BILLING_ADD') ? 'Billing' :
        (intent === 'PRICE' || intent === 'INVENTORY_SEARCH') ? 'Sales' : '';
    if (tag) await addCustomerTag(from, tag);

    let replyText = '';
    if (intent === 'INVOICE') {
        replyText = generateInvoice({ name: 'Customer', phone: from });
    } else {
        // AI Background processing
        const invContext = await searchInventory(text, pool);
        const finContext = await searchCustomer(from, pool);
        replyText = await aiReply(text, botConfig.aiProvider, invContext, finContext);
    }

    if (replyText) {
        await sendCloudMessage(from, replyText);
    }

    res.sendStatus(200);
});

async function sendCloudMessage(to, message) {
    try {
        const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: message } })
        });
        const resJson = await response.json();
        if (response.ok) {
            await saveWhatsAppMessage({ id: resJson.messages?.[0]?.id, from: 'system', to, text: message, type: 'outgoing', method: 'cloud' });
        }
    } catch (e) { console.error('[Cloud] Send Fail:', e.message); }
}

// 5. QR Bot (Baileys) headless logic
class QrBot {
    constructor() {
        this.sock = null;
        this.state = 'INIT';
    }

    async start() {
        const authPath = path.join(DATA_DIR, 'auth_info_baileys');
        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const { version } = await fetchLatestBaileysVersion();

        this.sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true, // Crucial for cloud logs
            logger: pino({ level: 'silent' })
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) console.log('[Baileys] New QR Code available in terminal/logs.');
            if (connection === 'open') console.log('[Baileys] Bot Connected!');
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) this.start();
            }
        });

        this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify' || !botConfig.isBotEnabled) return;
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            if (!text) return;

            console.log(`[QR] Received: "${text}" from ${from}`);

            const intent = detectIntent(text);
            let replyText = '';

            if (intent === 'INVOICE') {
                replyText = generateInvoice({ name: 'Customer', phone: from });
            } else {
                const invContext = await searchInventory(text, pool);
                const finContext = await searchCustomer(from.split('@')[0], pool);
                replyText = await aiReply(text, botConfig.aiProvider, invContext, finContext);
            }

            if (replyText) {
                await this.sock.sendMessage(from, { text: replyText });
                await saveWhatsAppMessage({ id: msg.key.id, from, to: 'me', text: replyText, type: 'outgoing', method: 'qr' });
            }
        });
    }
}

// 6. Startup
async function init() {
    await loadModules();
    app.listen(PORT, () => console.log(`[Webhook] Server active on port ${PORT}`));

    const qrBot = new QrBot();
    qrBot.start();
}

init();
