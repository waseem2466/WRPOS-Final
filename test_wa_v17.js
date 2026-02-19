const https = require('https');
const fs = require('fs');

const token = "EAAMDzAogNlABQsRETNz22SdQpcQbmdmNAcTiPqHxblvYjm4dsvmmKyahaE1ReukSAuIdNkkrikYCMwuSOS6v4KhoY2XuUFsfSRTzSklsN9OwW4Rd28JSN20ZA3HdyUtd3qllMz4sF13NDtZAtIDD2pAA2VszEdH7OIJpPfVaY6ZBVdBiycYlY1AtOCWwNOSEgZDZD";
const phoneId = "962954070236965";
const recipient = "94779336848";

const data = JSON.stringify({
    messaging_product: "whatsapp",
    to: recipient,
    type: "text",
    text: { body: "WR-POS: v17.0 Debug Test for 0779336848" }
});

const options = {
    hostname: 'graph.facebook.com',
    path: `/v17.0/${phoneId}/messages`,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

console.log(`Sending to ${recipient} via ${phoneId} (v17.0)...`);
const req = https.request(options, res => {
    console.log(`STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        console.log('RESPONSE:', body);
        try {
            fs.writeFileSync('wa_v17_result.json', JSON.stringify({ status: res.statusCode, body: JSON.parse(body) }, null, 2));
        } catch (e) {
            fs.writeFileSync('wa_v17_result.json', JSON.stringify({ status: res.statusCode, body: body }, null, 2));
        }
        process.exit(0);
    });
});

req.on('error', e => {
    console.error('ERROR:', e.message);
    process.exit(1);
});

req.write(data);
req.end();
setTimeout(() => { console.log('Timeout'); process.exit(1); }, 15000);
