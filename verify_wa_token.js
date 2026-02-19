const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

console.log('Script started');
dotenv.config({ path: path.join(__dirname, '.env') });
console.log('Config loaded');

const token = process.env.WHATSAPP_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Correct App Secret provided by user
const appSecret = '073bf62277e9fa5b927f1ace6d0cc731';

function getAppSecretProof(accessToken, secret) {
    return crypto.createHmac('sha256', secret).update(accessToken).digest('hex');
}

async function testToken() {
    console.log('--- WhatsApp Token Verification (with Proof) ---');
    console.log('Phone Number ID:', phoneId);
    console.log('Token (first 10 chars):', token.substring(0, 10) + '...');

    const proof = getAppSecretProof(token, appSecret);


    try {
        const url = `https://graph.facebook.com/v18.0/${phoneId}/messages?appsecret_proof=${proof}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },

            body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: "94719336848", // Using the number from your verifying script
                type: "text",
                text: { body: "WR POS: Token Verification Success! ✅" }
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('\n✅ SUCCESS!');
            console.log('Message ID:', data.messages?.[0]?.id);
        } else {
            console.log('\n❌ FAILED');
            console.log('Status:', response.status);
            console.log('Error:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('\n💥 ERROR:', error.message);
    }
}

testToken();
