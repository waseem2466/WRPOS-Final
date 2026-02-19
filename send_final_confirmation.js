const https = require('https');
const fs = require('fs');

const token = "EAAMDzAogNlABQsRETNz22SdQpcQbmdmNAcTiPqHxblvYjm4dsvmmKyahaE1ReukSAuIdNkkrikYCMwuSOS6v4KhoY2XuUFsfSRTzSklsN9OwW4Rd28JSN20ZA3HdyUtd3qllMz4sF13NDtZAtIDD2pAA2VszEdH7OIJpPfVaY6ZBVdBiycYlY1AtOCWwNOSEgZDZD";
const phoneId = "962954070236965";
const recipient = "94779336848";

const data = JSON.stringify({
    messaging_product: "whatsapp",
    to: recipient,
    type: "text",
    text: { body: "✅ WR-POS Service Verification: Message from 0764950844 to 0779336848 via Cloud API!" }
});

const options = {
    hostname: 'graph.facebook.com',
    path: `/v18.0/${phoneId}/messages`,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

console.log(`Sending final test to ${recipient}...`);
const req = https.request(options, res => {
    console.log(`STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        console.log('RESPONSE:', body);
        process.exit(0);
    });
});

req.on('error', e => {
    console.error('ERROR:', e.message);
    process.exit(1);
});

req.write(data);
req.end();
