const https = require('https');
const http = require('http');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

async function verifyOllama() {
    return new Promise((resolve) => {
        http.get('http://localhost:11434/api/tags', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ ok: true, data: JSON.parse(data) });
                } else {
                    resolve({ ok: false, error: 'Status ' + res.statusCode });
                }
            });
        }).on('error', (err) => {
            resolve({ ok: false, error: err.message });
        });
    });
}

async function verifyWhatsAppCloud() {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const recipient = '94779336848';

    if (!token || !phoneNumberId) {
        return { ok: false, error: 'Missing credentials' };
    }

    const postData = JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: { body: "✅ WR-POS Service Verification: Cloud API is working!" }
    });

    const options = {
        hostname: 'graph.facebook.com',
        path: `/v18.0/${phoneNumberId}/messages`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                let json;
                try { json = JSON.parse(data); } catch (e) { json = { error: { message: data } }; }
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ ok: true, id: json.messages[0].id });
                } else {
                    resolve({ ok: false, error: json.error?.message || data });
                }
            });
        });

        req.on('error', (err) => {
            resolve({ ok: false, error: err.message });
        });

        req.write(postData);
        req.end();
    });
}

async function run() {
    const ollama = await verifyOllama();
    const wa = await verifyWhatsAppCloud();

    const results = {
        ollama,
        wa,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(path.join(__dirname, 'verification_results.json'), JSON.stringify(results, null, 2));

    if (ollama.ok && wa.ok) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

run();
