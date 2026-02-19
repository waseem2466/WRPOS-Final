const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
const apiKey = process.env.VITE_FIREBASE_API_KEY;

async function testRaw() {
    console.log(`--- Raw Firebase Test ---`);
    console.log(`Project ID: ${projectId}`);

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/test_connection?key=${apiKey}`;

    try {
        console.log("Fetching documents from test_connection...");
        const res = await fetch(url);
        const data = await res.json();

        if (res.ok) {
            console.log("✅ RAW FETCH SUCCESS!");
            console.log("Response:", JSON.stringify(data, null, 2));
        } else {
            console.log(`❌ RAW FETCH FAIL: ${res.status} ${res.statusText}`);
            console.log("Error details:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.log(`❌ ERROR: ${e.message}`);
    }
}

testRaw();
