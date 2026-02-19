const https = require('https');
const fs = require('fs');

const data = JSON.stringify({
    messaging_product: "whatsapp",
    to: "94779336848",
    type: "text",
    text: {
        body: "Hello from WR-POS! Your message has been sent successfully."
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

console.log('Sending message to 0779336848...');
const req = https.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        fs.writeFileSync('send_specific_res.txt', `Status: ${res.statusCode}\nBody: ${body}\n`);
        console.log('Result:', body);
        process.exit(0);
    });
});

req.on('error', error => {
    console.error('Error:', error.message);
    process.exit(1);
});

req.write(data);
req.end();
