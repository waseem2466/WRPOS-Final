const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const pg = require('pg');
const { Pool } = pg;
const QRCode = require('qrcode');
const pino = require('pino');
const bcrypt = require('bcryptjs');
const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const { spawn } = require('child_process');
const shop = require('./shopData.cjs');
const { searchInventory, searchCustomer } = require('./dbHelper.cjs');

// Global error handlers to prevent silent crashes and red popup errors for handled cases
const logPath = path.join(app.getPath('userData'), 'main-process.log');
function logToFile(msg) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
}

process.on('unhandledRejection', (reason, promise) => {
    const msg = `[Main] Unhandled Rejection at: ${promise} reason: ${reason}`;
    console.error(msg);
    logToFile(msg);
});

process.on('uncaughtException', (error) => {
    const msg = `[Main] Uncaught Exception: ${error.stack || error}`;
    console.error(msg);
    logToFile(msg);
    if (error.message?.includes('Connection terminated unexpectedly')) {
        console.warn('[DB] Handled expected connection drop.');
    }
});


// Helper for UTF-8 safety (copied from services/stringUtils.ts to avoid ESM/CJS issues)
function ensureSafeUTF8(text) {
    if (!text) return '';
    try {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(text, 'utf-8').toString('utf-8');
        }
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
        return decoder.decode(encoder.encode(text));
    } catch (e) {
        console.error('Failed to sanitize UTF-8 string:', e);
        return '';
    }
}

function getAppSecretProof(accessToken, secret) {
    if (!accessToken || !secret) return null;
    return crypto.createHmac('sha256', secret).update(accessToken).digest('hex');
}


if (process.env.ELECTRON_RUN_AS_NODE) {
    delete process.env.ELECTRON_RUN_AS_NODE;
}

const envPath = app.isPackaged 
    ? path.join(process.resourcesPath, '.env') 
    : path.join(__dirname, '.env');
dotenv.config({ path: envPath });

console.log('[ENV] Environment loaded.');

let makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion;

let aiReply;
let detectIntent;
let generateInvoice;
let handleLoanInquiry;
let handleBalanceCheck;
let handlePriceQuery;
let handleAvailabilityQuery;
let handleBulkOrderQuery;
let isBotEnabled = true;
let ownedOllamaProcess = null;

const getOllamaBaseUrl = () => (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');

async function isOllamaReady() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const response = await fetch(`${getOllamaBaseUrl()}/api/version`, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        return false;
    }
}

function getOllamaExecutablePath() {
    const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
    const candidates = [
        process.env.OLLAMA_EXE_PATH,
        path.join(localAppData, 'Programs', 'OllamaCLI', 'ollama.exe'),
        path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe'),
        'ollama.exe',
        'ollama'
    ].filter(Boolean);

    return candidates.find((candidate) => !candidate.includes(path.sep) || fs.existsSync(candidate));
}

async function ensureOllamaServer() {
    if (process.env.WRPOS_AUTOSTART_OLLAMA === 'false') {
        console.log('[Ollama] Auto-start disabled by WRPOS_AUTOSTART_OLLAMA=false.');
        return false;
    }

    if (await isOllamaReady()) {
        console.log('[Ollama] Local server already running.');
        return true;
    }

    const ollamaPath = getOllamaExecutablePath();
    if (!ollamaPath) {
        console.warn('[Ollama] Could not find ollama.exe. Local AI will remain unavailable until Ollama is installed or started manually.');
        return false;
    }

    try {
        ownedOllamaProcess = spawn(ollamaPath, ['serve'], {
            detached: false,
            stdio: 'ignore',
            windowsHide: true,
            env: process.env
        });
        ownedOllamaProcess.unref();
        ownedOllamaProcess.on('error', (error) => {
            console.warn('[Ollama] Failed to auto-start:', error.message);
        });

        for (let attempt = 0; attempt < 12; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (await isOllamaReady()) {
                console.log(`[Ollama] Local server auto-started from ${ollamaPath}.`);
                return true;
            }
        }

        console.warn('[Ollama] Auto-start was attempted, but the API did not become ready in time.');
        return false;
    } catch (error) {
        console.warn('[Ollama] Auto-start failed:', error.message);
        return false;
    }
}

async function loadEsmModules() {
    // Load AI modules first — these are CJS and should always succeed
    try {
        const aiModule = require('./aiReply.cjs');
        aiReply = aiModule.aiReply;
        console.log('[AI] aiReply loaded');

        // const { createPgPoolConfig } = require('./dbConfig.cjs'); // Missing and unused
        const intentModule = require('./intent.cjs');
        detectIntent = intentModule.detectIntent;
        console.log('[AI] detectIntent loaded');

        const invoiceModule = require('./invoice.cjs');
        generateInvoice = invoiceModule.generateInvoice;
        console.log('[AI] generateInvoice loaded');

        const conversationModule = require('./conversationManager.cjs');
        handleLoanInquiry = conversationModule.handleLoanInquiry;
        handleBalanceCheck = conversationModule.handleBalanceCheck;
        console.log('[AI] conversationManager loaded');

        const productModule = require('./productPriceHandler.cjs');
        handlePriceQuery = productModule.handlePriceQuery;
        handleAvailabilityQuery = productModule.handleAvailabilityQuery;
        handleBulkOrderQuery = productModule.handleBulkOrderQuery;
        console.log('[AI] productPriceHandler loaded');

        console.log('[AI] All AI modules loaded successfully.');
    } catch (e) {
        console.error('[Module Load] Failed to load AI modules:', e);
    }

    // Load Baileys (ESM) separately — failure should not block AI
    try {
        const pkgBaileys = await import('@whiskeysockets/baileys');
        makeWASocket = pkgBaileys.default?.default || pkgBaileys.default;
        useMultiFileAuthState = pkgBaileys.useMultiFileAuthState;
        DisconnectReason = pkgBaileys.DisconnectReason;
        Browsers = pkgBaileys.Browsers;
        fetchLatestBaileysVersion = pkgBaileys.fetchLatestBaileysVersion;
        console.log('[Baileys] Modules mapped successfully');
    } catch (e) {
        console.error('[Module Load] Failed to load Baileys (WhatsApp QR will not work):', e);
    }
}

// Bot Configuration Management
let DATA_DIR;
let configPath;
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

const connectionString = process.env.DATABASE_URL;
const pools = new Map();

function getPool(id = 'default') {
    if (!pools.has(id)) {
        const newPool = new Pool({
            connectionString,
            ssl: (connectionString && connectionString.includes('neon.tech')) ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 5000,
            query_timeout: 20000,
            idle_in_transaction_session_timeout: 10000,
            max: 5
        });

        // CRITICAL: Handle errors on idle clients to prevent uncaught exceptions
        newPool.on('error', (err) => {
            console.error('[DB] Unexpected error on idle client:', err.message);
        });

        pools.set(id, newPool);
    }
    return pools.get(id);
}

async function saveWhatsAppMessage({ id, from, to, text, type, method }) {
    try {
        const pool = getPool();
        await pool.query(
            `INSERT INTO "WhatsAppMessage" (id, from_number, to_number, text, type, method, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`,
            [id || `msg_${Date.now()}`, from, to, ensureSafeUTF8(text), type, method, new Date()]
        );
        console.log('[DB] WhatsApp message saved:', id);
    } catch (e) {
        console.error('[DB] Msg Save Fail:', e.message);
    }
}

async function upsertCustomer(phone, name = null) {
    try {
        const pool = getPool();
        await pool.query(
            `INSERT INTO "Customer"(phone, name)
             VALUES ($1, $2)
             ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, "Customer".name)`,
            [phone, ensureSafeUTF8(name)]
        );
        console.log(`[CRM] Upserted customer: ${phone}`);
    } catch (e) {
        console.error(`[CRM] Failed to upsert customer ${phone}:`, e.message);
    }
}

async function addCustomerTag(phone, tag) {
    try {
        const pool = getPool();
        await pool.query(
            `UPDATE "Customer"
             SET tags = array_append(COALESCE(tags, '{}'), $2)
             WHERE phone = $1
             AND NOT ($2 = ANY(COALESCE(tags, '{}')))`,
            [phone, tag]
        );
        console.log(`[CRM] Added tag '${tag}' to customer: ${phone}`);
    } catch (e) {
        console.error(`[CRM] Failed to add tag '${tag}' to customer ${phone}:`, e.message);
    }
}

function extractText(msg) {
    return (
        msg?.message?.conversation ||
        msg?.message?.extendedTextMessage?.text ||
        msg?.message?.imageMessage?.caption ||
        msg?.message?.videoMessage?.caption ||
        msg?.message?.buttonsResponseMessage?.selectedDisplayText ||
        msg?.message?.listResponseMessage?.title ||
        msg?.message?.templateButtonReplyMessage?.selectedId ||
        msg?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
        ''
    );
}

class WhatsAppWebhookServer {
    constructor() {
        this.webhookApp = express();
        this.port = process.env.PORT || 3000;
        this.verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || "my_verify_token_123";
        this.server = null;
        this.mainWindow = null;
        this.setupRoutes();
    }
    setWindow(win) { this.mainWindow = win; }
    setupRoutes() {
        this.webhookApp.use(express.json());
        this.webhookApp.get("/webhook", (req, res) => {
            const mode = req.query["hub.mode"];
            const token = req.query["hub.verify_token"];
            const challenge = req.query["hub.challenge"];
            if (mode === "subscribe" && token === this.verifyToken) res.status(200).send(challenge);
            else res.sendStatus(403);
        });
        this.webhookApp.post("/webhook", async (req, res) => {
            const entry = req.body.entry?.[0];
            const msg = entry?.changes?.[0]?.value?.messages?.[0];
            if (!msg) return res.sendStatus(200);

            const text = msg.text?.body || '';

            console.log(`[Cloud Webhook] New message received from ${msg.from}: "${text}"`);

            const payload = {
                id: msg.id,
                from: msg.from,
                text: ensureSafeUTF8(text),
                method: 'cloud',
                timestamp: Date.now()
            };

            try {
                await saveWhatsAppMessage({
                    id: payload.id,
                    from: payload.from,
                    to: null,
                    text: payload.text,
                    type: 'incoming',
                    method: 'cloud'
                });
                console.log('[Cloud Webhook] Message saved to database.');
            } catch (dbErr) {
                console.error('[Cloud Webhook] DATABASE ERROR:', dbErr.message);
            }

            await upsertCustomer(msg.from);

            if (this.mainWindow) {
                // Send specific event for WhatsAppBotUI compatibility
                this.mainWindow.webContents.send('wa-cloud-message', payload);
                // Also send generic event for any other listeners
                this.mainWindow.webContents.send('wa-message', payload);
                console.log('[Cloud Webhook] Sent message to renderer via IPC.');
            } else {
                console.warn('[Cloud Webhook] Main window not available for IPC send.');
            }

            if (botConfig.isBotEnabled && detectIntent && aiReply) {
                const intent = detectIntent(text);
                const customerPhone = msg.from;

                // Enhanced Tagging Logic (Sync with AutoResponder.tsx)
                let tag = '';
                if (intent === 'INVOICE' || intent === 'BILLING_ADD') tag = 'Billing';
                else if (intent === 'PRICE' || intent === 'INVENTORY_SEARCH') tag = 'Sales';
                else if (intent === 'ANALYTICS') tag = 'Analytics';
                else if (intent === 'CUSTOMER_SEARCH' || intent === 'LOAN_INQUIRY' || intent === 'BALANCE_CHECK') tag = 'Support';

                if (tag) await addCustomerTag(customerPhone, tag);

                // Handle LOAN_INQUIRY with intelligent conversation flow
                if (intent === 'LOAN_INQUIRY' && handleLoanInquiry) {
                    try {
                        const result = await handleLoanInquiry(customerPhone, text);
                        if (result.handled) {
                            console.log(`[Cloud] Loan inquiry handled`);
                            const proof = getAppSecretProof(process.env.WHATSAPP_TOKEN, process.env.WHATSAPP_APP_SECRET);
                            const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages${proof ? `?appsecret_proof=${proof}` : ''}`;
                            const response = await fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    messaging_product: "whatsapp",
                                    recipient_type: "individual",
                                    to: customerPhone,
                                    type: "text",
                                    text: { body: result.reply }
                                })
                            });
                            if (response.ok) {
                                await saveWhatsAppMessage({
                                    id: `cloud_loan_${Date.now()}`,
                                    from: 'system',
                                    to: customerPhone,
                                    text: result.reply,
                                    type: 'outgoing',
                                    method: 'cloud'
                                });
                            }
                            return res.sendStatus(200);
                        }
                    } catch (err) {
                        console.error('[Cloud] Loan inquiry error:', err.message);
                    }
                }

                // Handle BALANCE_CHECK with intelligent conversation flow
                if (intent === 'BALANCE_CHECK' && handleBalanceCheck) {
                    try {
                        const result = await handleBalanceCheck(customerPhone, text);
                        if (result.handled) {
                            console.log(`[Cloud] Balance check handled`);
                            const proof = getAppSecretProof(process.env.WHATSAPP_TOKEN, process.env.WHATSAPP_APP_SECRET);
                            const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages${proof ? `?appsecret_proof=${proof}` : ''}`;
                            const response = await fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    messaging_product: "whatsapp",
                                    recipient_type: "individual",
                                    to: customerPhone,
                                    type: "text",
                                    text: { body: result.reply }
                                })
                            });
                            if (response.ok) {
                                await saveWhatsAppMessage({
                                    id: `cloud_balance_${Date.now()}`,
                                    from: 'system',
                                    to: customerPhone,
                                    text: result.reply,
                                    type: 'outgoing',
                                    method: 'cloud'
                                });
                            }
                            return res.sendStatus(200);
                        }
                    } catch (err) {
                        console.error('[Cloud] Balance check error:', err.message);
                    }
                }

                // Handle PRICE queries intelligently
                if ((intent === 'PRICE' || /price|how much|cost/i.test(text)) && handlePriceQuery) {
                    try {
                        const result = await handlePriceQuery(text);
                        if (result.handled) {
                            console.log(`[Cloud] Price query handled`);
                            const proof = getAppSecretProof(process.env.WHATSAPP_TOKEN, process.env.WHATSAPP_APP_SECRET);
                            const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages${proof ? `?appsecret_proof=${proof}` : ''}`;
                            const response = await fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    messaging_product: "whatsapp",
                                    recipient_type: "individual",
                                    to: customerPhone,
                                    type: "text",
                                    text: { body: result.reply }
                                })
                            });
                            if (response.ok) {
                                await saveWhatsAppMessage({
                                    id: `cloud_price_${Date.now()}`,
                                    from: 'system',
                                    to: customerPhone,
                                    text: result.reply,
                                    type: 'outgoing',
                                    method: 'cloud'
                                });
                            }
                            return res.sendStatus(200);
                        }
                    } catch (err) {
                        console.error('[Cloud] Price query error:', err.message);
                    }
                }

                // Handle PRODUCTS/AVAILABILITY queries
                if ((intent === 'PRODUCTS' || /have|got|stock|available/i.test(text)) && handleAvailabilityQuery) {
                    try {
                        const result = await handleAvailabilityQuery(text);
                        if (result.handled) {
                            console.log(`[Cloud] Availability query handled`);
                            const proof = getAppSecretProof(process.env.WHATSAPP_TOKEN, process.env.WHATSAPP_APP_SECRET);
                            const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages${proof ? `?appsecret_proof=${proof}` : ''}`;
                            const response = await fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    messaging_product: "whatsapp",
                                    recipient_type: "individual",
                                    to: customerPhone,
                                    type: "text",
                                    text: { body: result.reply }
                                })
                            });
                            if (response.ok) {
                                await saveWhatsAppMessage({
                                    id: `cloud_stock_${Date.now()}`,
                                    from: 'system',
                                    to: customerPhone,
                                    text: result.reply,
                                    type: 'outgoing',
                                    method: 'cloud'
                                });
                            }
                            return res.sendStatus(200);
                        }
                    } catch (err) {
                        console.error('[Cloud] Availability query error:', err.message);
                    }
                }

                // Handle BULK ORDER queries
                if (/need|want|order|buy.*\d+/i.test(text) && handleBulkOrderQuery) {
                    try {
                        const result = await handleBulkOrderQuery(text);
                        if (result.handled) {
                            console.log(`[Cloud] Bulk order query handled`);
                            const proof = getAppSecretProof(process.env.WHATSAPP_TOKEN, process.env.WHATSAPP_APP_SECRET);
                            const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages${proof ? `?appsecret_proof=${proof}` : ''}`;
                            const response = await fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    messaging_product: "whatsapp",
                                    recipient_type: "individual",
                                    to: customerPhone,
                                    type: "text",
                                    text: { body: result.reply }
                                })
                            });
                            if (response.ok) {
                                await saveWhatsAppMessage({
                                    id: `cloud_bulk_${Date.now()}`,
                                    from: 'system',
                                    to: customerPhone,
                                    text: result.reply,
                                    type: 'outgoing',
                                    method: 'cloud'
                                });
                            }
                            return res.sendStatus(200);
                        }
                    } catch (err) {
                        console.error('[Cloud] Bulk order error:', err.message);
                    }
                }

                // Special Intent: Invoice
                if (intent === 'INVOICE') {
                    console.log(`[Cloud Webhook] Generating Invoice for ${customerPhone}...`);
                    const invoiceText = generateInvoice({ name: 'Customer', phone: customerPhone });

                    if (this.mainWindow) {
                        this.mainWindow.webContents.send('wa-cloud-message', {
                            id: `inv_${Date.now()}`,
                            from: 'system',
                            text: invoiceText,
                            method: 'cloud',
                            timestamp: Date.now()
                        });
                    }

                    try {
                        const proof = getAppSecretProof(process.env.WHATSAPP_TOKEN, process.env.WHATSAPP_APP_SECRET);
                        const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages${proof ? `?appsecret_proof=${proof}` : ''}`;
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                messaging_product: "whatsapp",
                                recipient_type: "individual",
                                to: msg.from,
                                type: "text",
                                text: { body: invoiceText }
                            })
                        });
                        const resJson = await response.json();
                        if (response.ok) {
                            await saveWhatsAppMessage({
                                id: resJson.messages?.[0]?.id || `out_inv_${Date.now()}`,
                                from: 'system',
                                to: msg.from,
                                text: invoiceText,
                                type: 'outgoing',
                                method: 'cloud'
                            });
                        }
                    } catch (e) {
                        console.error('[Cloud Webhook] Failed to send invoice:', e.message);
                    }
                    return res.sendStatus(200);
                }

                // Context Fetching (Inventory + Financial)
                let inventoryContext = '';
                if (intent === 'PRICE' || intent === 'PRODUCTS' || intent === 'GENERAL' || intent === 'INVENTORY_SEARCH') {
                    try {
                        const products = await searchInventory(text);
                        if (products.length > 0) inventoryContext = products.map(p => `- ${p.name}: LKR ${p.price} (Stock: ${p.stock})`).join('\n');
                    } catch (err) { console.error('[AI Cloud] Inventory search failed:', err.message); }
                }

                let financialContext = '';
                if (intent === 'BALANCE' || intent === 'CUSTOMER_SEARCH' || /\d{9,}/.test(text)) {
                    try {
                        const customer = await searchCustomer(text);
                        if (customer) financialContext = `Name: ${customer.name}\nLoan: LKR ${customer.loan}\nPaid: LKR ${customer.paid}\nBalance: LKR ${customer.balance}`;
                    } catch (err) { console.error('[AI Cloud] Customer search failed:', err.message); }
                }

                // AI Reply
                const reply = await aiReply(text, botConfig.aiProvider, inventoryContext, financialContext);
                if (reply && this.mainWindow) {
                    console.log('[AI] Generated Cloud reply:', reply);

                    const aiPayload = {
                        id: `ai_${Date.now()}`,
                        from: 'system',
                        text: reply,
                        method: 'cloud',
                        timestamp: Date.now(),
                        isAI: true
                    };

                    this.mainWindow.webContents.send('wa-bot-reply', aiPayload);

                    try {
                        const proof = getAppSecretProof(process.env.WHATSAPP_TOKEN, process.env.WHATSAPP_APP_SECRET);
                        const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages${proof ? `?appsecret_proof=${proof}` : ''}`;
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                messaging_product: "whatsapp",
                                recipient_type: "individual",
                                to: msg.from,
                                type: "text",
                                text: { body: reply }
                            })
                        });

                        if (response.ok) {
                            const resJson = await response.json();
                            await saveWhatsAppMessage({
                                id: resJson.messages?.[0]?.id || aiPayload.id,
                                from: 'system',
                                to: msg.from,
                                text: reply,
                                type: 'outgoing',
                                method: 'cloud'
                            });
                        }
                    } catch (e) {
                        console.error('[Cloud Webhook] Failed to send AI reply:', e.message);
                    }
                }
            }
            res.sendStatus(200);
        });
    }
    start() { this.server = this.webhookApp.listen(this.port); }
    stop() { if (this.server) this.server.close(); }
}

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.qr = null;
        this.state = 'LOGGED_OUT';
        this.mainWindow = null;
        this.initializing = false;
        this.reconnectAttempts = 0;
    }

    setWindow(win) {
        this.mainWindow = win;
    }

    async init() {
        if (this.initializing) return;
        if (this.sock) {
            console.log('[Baileys] Socket already active, skipping.');
            return;
        }

        this.initializing = true;
        console.log('[Baileys] Initializing WhatsApp bot...');

        try {
            const authPath = path.join(app.getPath('userData'), 'auth_info_baileys');
            console.log(`[Baileys] Auth path: ${authPath}`);

            if (!fs.existsSync(authPath)) {
                fs.mkdirSync(authPath, { recursive: true });
                console.log('[Baileys] Created new auth directory');
            }

            const { state, saveCreds } = await useMultiFileAuthState(authPath);
            console.log('[Baileys] Auth state loaded');

            let { version } = await fetchLatestBaileysVersion();
            console.log(`[Baileys] Using Baileys version: ${version.js} / ${version.isLatest}`);

            this.sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome'),  // Use Baileys' built-in safe browser
                syncFullHistory: false,
                markOnlineOnConnect: true,
                logger: pino({ level: 'info' }),
                connectTimeoutMs: 90000,  // Increased timeout
                defaultQueryTimeoutMs: 90000,
                keepAliveIntervalMs: 15000,
                retryRequestDelayMs: 5000,
            });

            console.log('[Baileys] Socket created, setting up event handlers...');
            this.sock.ev.on('creds.update', saveCreds);

            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                console.log(`[Baileys Sync] Event: ${connection || 'status_update'}, QR: ${!!qr}, State: ${this.state}`);

                if (qr) {
                    console.log('[Baileys] QR code received - awaiting scan from WhatsApp...');
                    this.qr = await QRCode.toDataURL(qr);
                    this.state = 'QR_READY';
                    this.notifyStatus();
                }

                if (connection === 'open') {
                    console.log('[Baileys] ✅ Connection opened successfully - Device Linked!');
                    this.state = 'LINKED';
                    this.qr = null;
                    this.reconnectAttempts = 0;
                    this.notifyStatus();
                }

                if (connection === 'close') {
                    const statusCode = (lastDisconnect?.error)?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

                    console.log(`[Baileys] Connection closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);
                    console.log(`[Baileys] Error Details:`, lastDisconnect?.error);

                    this.sock = null;
                    this.state = 'LOGGED_OUT';
                    this.qr = null;
                    this.notifyStatus();

                    if (shouldReconnect) {
                        this.reconnectAttempts++;
                        const delay = Math.min(this.reconnectAttempts * 5000, 60000);
                        console.warn(`[Baileys Status] CONNECTION DROP (Error: ${statusCode}). Attempting Reconnect #${this.reconnectAttempts} in ${delay}ms...`);

                        if (this.mainWindow) {
                            this.mainWindow.webContents.send('wa-status-update', {
                                state: 'RECONNECTING',
                                qr: null,
                                error: `Connection lost (Code: ${statusCode}). Reconnecting...`
                            });
                        }

                        setTimeout(() => this.init(), delay);
                    } else {
                        console.log('[Baileys] Logged out or unauthorized. Session cleared.');
                    }
                }
            });

            this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type !== 'notify') return;

                for (const msg of messages) {
                    if (msg.key.fromMe) continue;

                    const text = extractText(msg);
                    if (!text) continue;

                    console.log(`[Baileys] Incoming message from ${msg.key.remoteJid}: ${text}`);

                    console.log(`[Baileys Socket] Incoming message from ${msg.key.remoteJid}: "${text}"`);

                    const payload = {
                        id: msg.key.id,
                        from: msg.key.remoteJid,
                        text,
                        method: 'qr',
                        timestamp: Date.now()
                    };

                    try {
                        await saveWhatsAppMessage({
                            id: payload.id,
                            from: payload.from,
                            to: null,
                            text: payload.text,
                            type: 'incoming',
                            method: 'qr'
                        });
                        console.log('[Baileys Socket] Message saved to database.');
                    } catch (dbErr) {
                        console.error('[Baileys Socket] DATABASE ERROR:', dbErr.message);
                    }

                    await upsertCustomer(msg.key.remoteJid);

                    if (this.mainWindow) {
                        // Send specific event for WhatsAppBotUI compatibility
                        this.mainWindow.webContents.send('wa-qr-message', payload);
                        // Also send generic event for any other listeners
                        this.mainWindow.webContents.send('wa-message', payload);
                        console.log('[Baileys Socket] Sent message to renderer via IPC.');
                    } else {
                        console.warn('[Baileys Socket] Main window not available for IPC send.');
                    }

                    // Auto-reply logic
                    if (botConfig.isBotEnabled && detectIntent && aiReply && generateInvoice) {
                        const intent = detectIntent(text);
                        const customerPhone = msg.key.remoteJid;

                        // Enhanced Tagging Logic
                        let tag = '';
                        if (intent === 'INVOICE' || intent === 'BILLING_ADD') tag = 'Billing';
                        else if (intent === 'PRICE' || intent === 'INVENTORY_SEARCH') tag = 'Sales';
                        else if (intent === 'ANALYTICS') tag = 'Analytics';
                        else if (intent === 'CUSTOMER_SEARCH' || intent === 'LOAN_INQUIRY' || intent === 'BALANCE_CHECK') tag = 'Support';

                        if (tag) await addCustomerTag(customerPhone, tag);

                        // Handle LOAN_INQUIRY with intelligent conversation flow
                        if (intent === 'LOAN_INQUIRY' && handleLoanInquiry) {
                            try {
                                const result = await handleLoanInquiry(customerPhone, text);
                                if (result.handled) {
                                    console.log(`[AI] Loan inquiry handled with response:`, result.reply);
                                    await this.sendMessage(msg.key.remoteJid, result.reply);
                                    if (this.mainWindow) {
                                        this.mainWindow.webContents.send('wa-bot-reply', {
                                            id: `qr_loan_${Date.now()}`,
                                            from: 'system',
                                            text: result.reply,
                                            method: 'qr',
                                            timestamp: Date.now(),
                                            isAI: true
                                        });
                                    }
                                    continue;
                                }
                            } catch (err) {
                                console.error('[AI] Loan inquiry error:', err.message);
                            }
                        }

                        // Handle BALANCE_CHECK with intelligent conversation flow
                        if (intent === 'BALANCE_CHECK' && handleBalanceCheck) {
                            try {
                                const result = await handleBalanceCheck(customerPhone, text);
                                if (result.handled) {
                                    console.log(`[AI] Balance check handled with response:`, result.reply);
                                    await this.sendMessage(msg.key.remoteJid, result.reply);
                                    if (this.mainWindow) {
                                        this.mainWindow.webContents.send('wa-bot-reply', {
                                            id: `qr_balance_${Date.now()}`,
                                            from: 'system',
                                            text: result.reply,
                                            method: 'qr',
                                            timestamp: Date.now(),
                                            isAI: true
                                        });
                                    }
                                    continue;
                                }
                            } catch (err) {
                                console.error('[AI] Balance check error:', err.message);
                            }
                        }

                        // Handle PRICE queries intelligently
                        if ((intent === 'PRICE' || /price|how much|cost/i.test(text)) && handlePriceQuery) {
                            try {
                                const result = await handlePriceQuery(text);
                                if (result.handled) {
                                    console.log(`[AI] Price query handled`);
                                    await this.sendMessage(msg.key.remoteJid, result.reply);
                                    if (this.mainWindow) {
                                        this.mainWindow.webContents.send('wa-bot-reply', {
                                            id: `qr_price_${Date.now()}`,
                                            from: 'system',
                                            text: result.reply,
                                            method: 'qr',
                                            timestamp: Date.now(),
                                            isAI: true
                                        });
                                    }
                                    continue;
                                }
                            } catch (err) {
                                console.error('[AI] Price query error:', err.message);
                            }
                        }

                        // Handle PRODUCTS/AVAILABILITY queries
                        if ((intent === 'PRODUCTS' || /have|got|stock|available/i.test(text)) && handleAvailabilityQuery) {
                            try {
                                const result = await handleAvailabilityQuery(text);
                                if (result.handled) {
                                    console.log(`[AI] Availability query handled`);
                                    await this.sendMessage(msg.key.remoteJid, result.reply);
                                    if (this.mainWindow) {
                                        this.mainWindow.webContents.send('wa-bot-reply', {
                                            id: `qr_stock_${Date.now()}`,
                                            from: 'system',
                                            text: result.reply,
                                            method: 'qr',
                                            timestamp: Date.now(),
                                            isAI: true
                                        });
                                    }
                                    continue;
                                }
                            } catch (err) {
                                console.error('[AI] Availability query error:', err.message);
                            }
                        }

                        // Handle BULK ORDER queries
                        if (/need|want|order|buy.*\d+/i.test(text) && handleBulkOrderQuery) {
                            try {
                                const result = await handleBulkOrderQuery(text);
                                if (result.handled) {
                                    console.log(`[AI] Bulk order query handled`);
                                    await this.sendMessage(msg.key.remoteJid, result.reply);
                                    if (this.mainWindow) {
                                        this.mainWindow.webContents.send('wa-bot-reply', {
                                            id: `qr_bulk_${Date.now()}`,
                                            from: 'system',
                                            text: result.reply,
                                            method: 'qr',
                                            timestamp: Date.now(),
                                            isAI: true
                                        });
                                    }
                                    continue;
                                }
                            } catch (err) {
                                console.error('[AI] Bulk order error:', err.message);
                            }
                        }

                        if (intent === 'INVOICE') {
                            console.log(`[AI] Generating Invoice for ${customerPhone}...`);

                            // Generate and send invoice
                            const invoiceText = generateInvoice({ name: 'Customer', phone: customerPhone });
                            console.log(`[AI] Sending Invoice:`, invoiceText);
                            await this.sendMessage(msg.key.remoteJid, invoiceText);

                            // Prevent further AI processing for this message
                            continue;
                        }

                        // Handle multimedia responses for specific intents
                        if (intent === 'PRODUCTS' || intent === 'OFFERS') {
                            const imagePath = path.join(__dirname, 'images', 'shop_products.jpg');
                            if (fs.existsSync(imagePath)) {
                                console.log(`[AI] Sending multimedia response for ${intent} to ${customerPhone}`);
                                const caption = await aiReply(text, botConfig.aiProvider);
                                await this.sock.sendMessage(customerPhone, {
                                    image: { url: imagePath },
                                    caption: caption
                                });

                                if (this.mainWindow) {
                                    this.mainWindow.webContents.send('wa-bot-reply', {
                                        id: `qr_media_${Date.now()}`,
                                        from: 'system',
                                        text: `[IMAGE] ${caption}`,
                                        method: 'qr',
                                        timestamp: Date.now(),
                                        isAI: true
                                    });
                                }
                                continue;
                            }
                        }

                        console.log(`[AI] Generating QR reply for intent: ${intent}...`);

                        // Fetch live inventory context if relevant
                        let inventoryContext = '';
                        if (intent === 'PRICE' || intent === 'PRODUCTS' || intent === 'GENERAL' || intent === 'INVENTORY_SEARCH') {
                            try {
                                const products = await searchInventory(text);
                                if (products.length > 0) {
                                    inventoryContext = products.map(p => `- ${p.name}: LKR ${p.price} (Stock: ${p.stock})`).join('\n');
                                    console.log(`[AI] Found ${products.length} matching products for context.`);
                                }
                            } catch (err) {
                                console.error('[AI] Inventory search failed:', err.message);
                            }
                        }

                        // Fetch financial context if relevant
                        let financialContext = '';
                        if (intent === 'BALANCE_CHECK' || intent === 'LOAN_INQUIRY' || /\d{9,}/.test(text)) {
                            try {
                                const customer = await searchCustomer(text);
                                if (customer) {
                                    financialContext = `Name: ${customer.name}\nLoan: LKR ${customer.loan}\nPaid: LKR ${customer.paid}\nBalance: LKR ${customer.balance}\nOpenClaw Available: LKR ${customer.openclaw_available}`;
                                    console.log(`[AI] Found customer financial data: ${customer.name}`);
                                }
                            } catch (err) {
                                console.error('[AI] Customer search failed:', err.message);
                            }
                        }

                        const reply = await aiReply(text, botConfig.aiProvider, inventoryContext, financialContext);
                        if (reply) {
                            console.log(`[AI] Auto-replying to ${customerPhone}: ${reply}`);
                            const result = await this.sendMessage(msg.key.remoteJid, reply);

                            if (this.mainWindow) {
                                this.mainWindow.webContents.send('wa-bot-reply', {
                                    id: result?.key?.id || `qr_ai_${Date.now()}`,
                                    from: 'system',
                                    text: reply,
                                    method: 'qr',
                                    timestamp: Date.now(),
                                    isAI: true
                                });
                            }
                        }
                    }
                }
            });

        } catch (err) {
            console.error('[Baileys] Init error:', err);
            this.sock = null;
        } finally {
            this.initializing = false;
        }
    }

    notifyStatus() {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('wa-status-update', {
                state: this.state,
                qr: this.qr,
                isBotEnabled: botConfig.isBotEnabled // Pass state to UI
            });
        }
    }

    async logout() {
        console.log('[Baileys] Logging out and clearing session...');
        this.initializing = false;

        if (this.sock) {
            try {
                console.log('[Baileys] Attempting logout...');
                await this.sock.logout().catch(() => {
                    console.log('[Baileys] Logout call failed, forcing disconnect...');
                });
                this.sock.end();
            } catch (e) {
                console.error('[Baileys] Error during logout:', e.message);
            }
            this.sock = null;
        }

        const authPath = path.join(app.getPath('userData'), 'auth_info_baileys');
        if (fs.existsSync(authPath)) {
            try {
                // Ensure some delay to let files be released
                await new Promise(resolve => setTimeout(resolve, 1000));
                fs.rmSync(authPath, { recursive: true, force: true });
                console.log('[Baileys] Auth folder deleted successfully.');
            } catch (e) {
                console.error('[Baileys] Failed to delete auth folder (might be locked):', e.message);
            }
        }

        this.state = 'LOGGED_OUT';
        this.qr = null;
        this.notifyStatus();
    }

    async sendMessage(to, message) {
        if (!this.sock || this.state !== 'LINKED') {
            console.warn('[Baileys] Cannot send message: not connected.');
            return null;
        }
        try {
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
            const result = await this.sock.sendMessage(jid, { text: message });

            // Log outgoing QR message
            await saveWhatsAppMessage({
                id: result.key.id,
                from: 'system',
                to: to,
                text: message,
                type: 'outgoing',
                method: 'qr'
            });

            return result;
        } catch (e) {

            console.error('[Baileys] Send error:', e.message);
            return null;
        }
    }
}

const webhookServer = new WhatsAppWebhookServer();
const qrBot = new WhatsAppBot();

// ===== FIREBASE FIX: Express Server for localhost:3000 =====
// Firebase requires http:// protocol, not file://, so we serve the app from localhost
// This fixes "auth/unauthorized-domain" errors in both dev and production builds
const appServer = express();
const SERVER_PORT = 3000;
let serverStarted = false;

function startAppServer() {
    return new Promise((resolve) => {
        if (serverStarted) {
            resolve();
            return;
        }

        appServer.use(express.static(path.join(__dirname, 'dist'), {
            index: 'index.html',
            maxAge: '1d'
        }));

        // Handle SPA routing: fallback to index.html for non-file routes
        appServer.use((req, res, next) => {
            // Only fallback if it's not a static file request (which express.static handles above)
            res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        });

        const server = appServer.listen(SERVER_PORT, 'localhost', () => {
            console.log(`[App Server] Running on http://localhost:${SERVER_PORT}`);
            serverStarted = true;
            resolve();
        });

        server.on('error', (err) => {
            console.error(`[App Server] Failed to start:`, err.message);
            resolve(); // Continue anyway, fallback will handle it
        });
    });
}

app.whenReady().then(async () => {
    try {
        logToFile('App starting...');
        global.fetch = fetch;

        DATA_DIR = path.join(app.getPath('userData'), 'data');
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        configPath = path.join(DATA_DIR, 'bot_config.json');

        loadConfig();
        await loadEsmModules();
        
        // Start the localhost server before creating the window
        if (app.isPackaged) {
            await startAppServer();
        }

        const iconPath = app.isPackaged 
            ? path.join(process.resourcesPath, 'icon.ico')
            : path.join(__dirname, "dist/favicon.ico");

        const mainWindow = new BrowserWindow({
            width: 1200, height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "preload.cjs"),
                webSecurity: false
            },
            icon: iconPath,
        });

        // IMPROVED LOAD LOGIC: Use localhost for Firebase compatibility
        if (app.isPackaged) {
            logToFile('Loading production URL...');
            mainWindow.loadURL(`http://localhost:${SERVER_PORT}`).catch((err) => {
                const msg = `CRITICAL: Failed to load app from localhost: ${err.message}`;
                console.error(msg);
                logToFile(msg);
                mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
            });
        } else {
            mainWindow.loadURL("http://localhost:5173").catch(() => {
                startAppServer().then(() => {
                    mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
                });
            });
        }

    webhookServer.setWindow(mainWindow);
    webhookServer.start();
    qrBot.setWindow(mainWindow);
    qrBot.init();

    // IPC Handlers
    ipcMain.handle('wa-get-status', () => ({ state: qrBot.state, qr: qrBot.qr }));
    ipcMain.handle('wa-link', async () => {
        console.log('[IPC] wa-link handler called');
        try {
            await qrBot.logout();
            console.log('[IPC] Previous session cleared, initializing new connection...');
            qrBot.init(); // Start async initialization

            // Wait for QR to be generated (max 15 seconds)
            let attempts = 0;
            while (qrBot.state !== 'QR_READY' && qrBot.state !== 'LINKED' && attempts < 150) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            console.log(`[IPC] State update completed: ${qrBot.state} (${attempts * 100}ms)`);
            return { success: true, state: qrBot.state };
        } catch (e) {
            console.error('[IPC] wa-link error:', e);
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('wa-logout', () => qrBot.logout());
    ipcMain.handle('wa-qr-send', async (e, data) => qrBot.sendMessage(data.to, data.message));
    ipcMain.handle('wa-qr-test', async (e, data) => {
        try {
            const result = await qrBot.sendMessage(data.to, '✅ WR POS Bot is active and responding!');
            return { success: !!result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // --- AI Handler (Local + Cloud) ---
    ipcMain.handle("ask-ai", async (event, { prompt, model }) => {
        try {
            console.log(`[AI] Asking Local AI (${model || "phi3"})...`);

            // Create an AbortController for the timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s hard timeout

            const response = await fetch("http://localhost:11434/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: model || "phi3",
                    prompt: prompt,
                    stream: false
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error(`[AI] Ollama Error: ${response.statusText}`);
                return "AI Service Unavailable (Check Ollama)";
            }

            const data = await response.json();
            return data.response || "No response from AI";

        } catch (error) {
            console.error("AI Error:", error);
            if (error.name === 'AbortError') {
                return "⚠️ Local AI timed out (60s). Please try again.";
            }
            return `AI Connection Failed: ${error.message}`;
        }
    });

    ipcMain.handle('db-query', async (e, { text, params, clientId }) => {
        try {
            const pool = getPool(clientId);
            const result = await pool.query(text, params);
            return { success: true, rows: result.rows };
        } catch (error) {
            console.error('[DB] Query error:', error.message);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-connect', async () => {
        try {
            const pool = getPool();
            try {
                await pool.query('SELECT 1');
            } catch (err) {
                console.error('[DB] Health check failed:', err.message);
                throw err;
            }
            return { success: true, clientId: 'default' };
        } catch (error) {
            console.error('[DB] Connect error:', error.message);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-release', async (e, clientId) => {
        if (clientId !== 'default' && pools.has(clientId)) {
            await pools.get(clientId).end();
            pools.delete(clientId);
        }
        return { success: true };
    });

    ipcMain.handle('auth-hash', async (e, password) => {
        return bcrypt.hash(password, 10);
    });

    ipcMain.handle('auth-compare', async (e, password, hash) => {
        return bcrypt.compare(password, hash);
    });

    ipcMain.handle('wa-cloud-get', async () => ({
        token: process.env.WHATSAPP_TOKEN || '',
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || ''
    }));

    ipcMain.handle('wa-cloud-save', async (e, config) => {
        process.env.WHATSAPP_TOKEN = config.token;
        process.env.WHATSAPP_PHONE_NUMBER_ID = config.phoneNumberId;
        return { success: true };
    });

    ipcMain.handle('wa-cloud-send', async (e, data) => {
        try {
            const token = data.token || process.env.WHATSAPP_TOKEN;
            const phoneNumberId = data.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
            const appSecret = process.env.WHATSAPP_APP_SECRET;

            if (!token || !phoneNumberId) {
                return { success: false, error: 'WhatsApp Cloud credentials missing' };
            }

            const proof = getAppSecretProof(token, appSecret);
            const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages${proof ? `?appsecret_proof=${proof}` : ''}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: data.to,
                    type: "text",
                    text: { body: data.message }
                })
            });
            const result = await response.json();
            if (response.ok) {
                await saveWhatsAppMessage({
                    id: result.messages?.[0]?.id || `out_${Date.now()}`,
                    from: 'system',
                    to: data.to,
                    text: data.message,
                    type: 'outgoing',
                    method: 'cloud'
                });
                return { success: true, id: result.messages?.[0]?.id };
            } else {
                console.error('[Cloud send error]:', JSON.stringify(result));
                return { success: false, error: result.error?.message || 'Unknown WhatsApp Error' };
            }
        } catch (error) {
            console.error('[Cloud catch error]:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('wa-cloud-send-template', async (e, data) => {
        try {
            const token = data.token || process.env.WHATSAPP_TOKEN;
            const phoneNumberId = data.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
            const appSecret = process.env.WHATSAPP_APP_SECRET;

            if (!token || !phoneNumberId) {
                return { success: false, error: 'WhatsApp Cloud credentials missing' };
            }

            const proof = getAppSecretProof(token, appSecret);
            const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages${proof ? `?appsecret_proof=${proof}` : ''}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: data.to,
                    type: "template",
                    template: {
                        name: data.template,
                        language: { code: data.language || 'en_US' },
                        components: [
                            {
                                type: "body",
                                parameters: (data.params || []).map(p => ({ type: "text", text: p.toString() }))
                            }
                        ]
                    }
                })
            });

            const result = await response.json();
            if (response.ok) {
                await saveWhatsAppMessage({
                    id: result.messages?.[0]?.id || `tmpl_${Date.now()}`,
                    from: 'system',
                    to: data.to,
                    text: `[Template: ${data.template}] ${data.params?.join(', ') || ''}`,
                    type: 'outgoing',
                    method: 'cloud'
                });
            }
            return { success: response.ok, id: result.messages?.[0]?.id, error: result.error };

        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('wa-cloud-get-history', async (e, { limit = 50 }) => {
        try {
            const pool = getPool();
            const res = await pool.query(`SELECT * FROM "WhatsAppMessage" ORDER BY timestamp DESC LIMIT $1`, [limit]);
            return res.rows.map(row => ({
                id: row.id,
                from: row.from_number,
                to: row.to_number,
                text: row.text,
                type: row.type,
                method: row.method,
                timestamp: row.timestamp.toISOString()
            })).reverse();
        } catch (e) {
            return [];
        }
    });

    ipcMain.handle('wa-get-webhook-url', async () => {
        return (process.env.WEBHOOK_URL || `http://localhost:${webhookServer.port}`).replace(/\/$/, '') + '/webhook';
    });

    // --- Additional Handlers ---
    ipcMain.handle('wa-set-bot-state', async (e, active) => {
        botConfig.isBotEnabled = active;
        saveConfig();
        console.log(`[AI BOT] Bot State Synced & Saved: ${botConfig.isBotEnabled ? 'ACTIVE' : 'DISABLED'}`);
        return true;
    });

    ipcMain.handle('wa-get-bot-config', () => botConfig);
    ipcMain.handle('wa-get-bot-status-debug', () => ({
        state: qrBot.state,
        qr: qrBot.qr ? 'QR_GENERATED' : null,
        initializing: qrBot.initializing,
        connected: !!qrBot.sock,
        reconnectAttempts: qrBot.reconnectAttempts
    }));
    ipcMain.handle('wa-set-bot-provider', (e, provider) => {
        botConfig.aiProvider = provider;
        saveConfig();
        return true;
    });

    ipcMain.handle('sms-gateway-get', async () => ({
        url: process.env.SMS_GATEWAY_URL || '',
        token: process.env.SMS_GATEWAY_TOKEN || '',
        globalToken: process.env.SMS_GATEWAY_GLOBAL_TOKEN || ''
    }));

    ipcMain.handle('sms-gateway-save', async (e, config) => {
        process.env.SMS_GATEWAY_URL = config.url;
        process.env.SMS_GATEWAY_TOKEN = config.token;
        process.env.SMS_GATEWAY_GLOBAL_TOKEN = config.globalToken;
        return { success: true };
    });

    ipcMain.handle('sms-gateway-send', async (e, data) => {
        try {
            const endpoint = `${process.env.SMS_GATEWAY_URL}/api/send`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': process.env.SMS_GATEWAY_TOKEN,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: data.to,
                    message: data.message
                })
            });
            const result = await response.json();
            return { success: response.ok, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('open-file', async (e, filePath) => {
        try {
            if (fs.existsSync(filePath)) {
                await shell.openPath(filePath);
                return { success: true };
            }
            return { success: false, error: 'File not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
    } catch (err) {
        const msg = `FATAL STARTUP ERROR: ${err.stack || err}`;
        console.error(msg);
        if (typeof logToFile === 'function') logToFile(msg);
    }
});

async function ensurePosSchema() {
    // Placeholder to prevent ReferenceErrors. 
    // In production, this should check and update database tables if needed.
    console.log('[DB] ensurePosSchema called (placeholder)');
    return true;
}

app.on("window-all-closed", () => {
    if (webhookServer) webhookServer.stop();
    if (process.platform !== "darwin") app.quit();
});

app.on('before-quit', () => {
    if (ownedOllamaProcess && !ownedOllamaProcess.killed) {
        ownedOllamaProcess.kill();
    }
});
