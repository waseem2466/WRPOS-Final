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

const req = https.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        fs.writeFileSync('wa_result.txt', `Status: ${res.statusCode}\nBody: ${body}`);
        console.log('Done');
    });
});

req.on('error', error => {
    fs.writeFileSync('wa_result.txt', `Error: ${error.message}`);
    console.error(error);
});

req.write(data);
req.end();
