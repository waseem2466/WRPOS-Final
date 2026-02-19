const https = require('https');
const fs = require('fs');

const data = JSON.stringify({
    messaging_product: "whatsapp",
    to: "94779336848",
    type: "text",
    text: {
        body: "✅ WR-POS Service Verification: Message from 0764950844 to 0779336848 via Cloud API!"
    }
});

const options = {
    hostname: 'graph.facebook.com',
    path: '/v18.0/962954070236965/messages',
    method: 'POST',
    headers: {
        'Authorization': 'Bearer EAAMDzAogNlABQsRETNz22SdQpcQbmdmNAcTiPqHxblvYjm4dsvmmKyahaE1ReukSAuIdNkkrikYCMwuSOS6v4KhoY2XuUFsfSRTzSklsN9OwW4Rd28JSN20ZA3HdyUtd3qllMz4sF13NDtZAtIDD2pAA2VszEdH7OIJpPfVaY6ZBVdBiycYlY1AtOCWwNOSEgZDZD',
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('Sending message...');
const req = https.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        fs.writeFileSync('final_wa_res.txt', `Status: ${res.statusCode}\nBody: ${body}\n`);
        console.log('Result written to final_wa_res.txt');
        process.exit(0);
    });
});

req.on('error', error => {
    fs.writeFileSync('final_wa_res.txt', `Error: ${error.message}\n`);
    console.error(error);
    process.exit(1);
});

req.write(data);
req.end();
setTimeout(() => {
    console.log('Timeout reached');
    process.exit(1);
}, 20000);
