require('dotenv').config();

async function testWhatsAppSend() {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    console.log('========================================');
    console.log('WhatsApp Cloud API - Send Test');
    console.log('========================================');
    console.log(`Phone Number ID: ${phoneNumberId}`);
    console.log(`Token: ${token.substring(0, 20)}...`);
    console.log('');

    // Ask user for recipient number
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('Enter recipient WhatsApp number (with country code, e.g., 94779336848): ', async (recipientNumber) => {
        readline.question('Enter message to send: ', async (messageText) => {
            console.log('');
            console.log(`Sending message to: ${recipientNumber}`);
            console.log(`Message: "${messageText}"`);
            console.log('');

            try {
                const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        to: recipientNumber,
                        type: 'text',
                        text: {
                            body: messageText
                        }
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    console.log('✅ SUCCESS! Message sent!');
                    console.log('Response:', JSON.stringify(data, null, 2));
                } else {
                    console.log('❌ FAILED! Error sending message');
                    console.log('Response:', JSON.stringify(data, null, 2));
                }
            } catch (error) {
                console.log('❌ ERROR:', error.message);
            }

            readline.close();
        });
    });
}

testWhatsAppSend();
