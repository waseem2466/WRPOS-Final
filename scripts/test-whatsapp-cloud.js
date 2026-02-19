const dotenv = require('dotenv');
const fetch = require('node-fetch');
const path = require('path');
const crypto = require('crypto');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

function getAppSecretProof(accessToken, secret) {
    if (!accessToken || !secret) return null;
    return crypto.createHmac('sha256', secret).update(accessToken).digest('hex');
}

async function testCloudWhatsApp() {
    console.log('---------------------------------------------------');
    console.log('WR POS - WhatsApp Cloud API Test');
    console.log('---------------------------------------------------');

    if (!TOKEN || !PHONE_ID) {
        console.error('❌ Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID in .env');
        process.exit(1);
    }

    console.log(`Using Phone ID: ${PHONE_ID}`);
    // console.log(`Using Token: ${TOKEN.substring(0, 10)}...`);

    // We need a recipient phone number. 
    // Ideally, we ask the user, but for a script we can try to send to a "test" number 
    // or arguably better: send to the number that owns the app if we knew it?
    // Actually, Cloud API messages must be sent TO a valid WhatsApp number.
    // We will ask the user to hardcode their number here or pass it as arg.

    const recipient = process.argv[2];

    if (!recipient) {
        console.log('\n⚠️  USAGE: node scripts/test-whatsapp-cloud.js <PHONE_NUMBER>');
        console.log('   Example: node scripts/test-whatsapp-cloud.js 919876543210');
        console.log('   (Include country code, no + symbol)\n');
        process.exit(0);
    }

    console.log(`Attempting to send "hello_world" template to ${recipient}...`);

    try {
        const proof = getAppSecretProof(TOKEN, APP_SECRET);
        const url = `https://graph.facebook.com/v18.0/${PHONE_ID}/messages${proof ? `?appsecret_proof=${proof}` : ''}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: recipient,
                type: "template",
                template: {
                    name: "hello_world",
                    language: { code: "en_US" }
                }
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Template Message SENT!');
            console.log('Message ID:', data.messages?.[0]?.id);
            console.log('---------------------------------------------------');
            console.log('Check your WhatsApp for a "Hello World" message from Meta.');
        } else {
            console.error('❌ Failed to send message.');
            console.error('Error:', JSON.stringify(data.error, null, 2));
        }

    } catch (err) {
        console.error('❌ Network Error:', err.message);
    }
}

testCloudWhatsApp();
