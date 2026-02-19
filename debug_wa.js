const https = require('https');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'final_wa_debug.log');
const log = (msg) => {
    const entry = `${new Date().toISOString()} - ${msg}\n`;
    fs.appendFileSync(logFile, entry);
    console.log(msg);
};

const data = JSON.stringify({
    messaging_product: "whatsapp",
    to: "94779336848",
    type: "text",
    text: {
        body: "✅ WR-POS: Absolute Debug Test"
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

log('Starting request...');
const req = https.request(options, res => {
    log(`Status: ${res.statusCode}`);
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        log(`Response Body: ${body}`);
        process.exit(0);
    });
});

req.on('error', error => {
    log(`Error: ${error.message}`);
    process.exit(1);
});

req.write(data);
req.end();

setTimeout(() => {
    log('TIMEOUT after 30 seconds');
    process.exit(1);
}, 30000);
