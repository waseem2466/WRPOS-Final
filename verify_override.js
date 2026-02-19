const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');
const fs = require('fs');
const dotenv = require('dotenv');
const path = require('path');

const logFile = path.join(__dirname, 'VERIFY_OVERRIDE.log');
function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\r\n');
}

dotenv.config({ path: path.join(__dirname, '.env'), override: true });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

async function run() {
    log("=== Firebase Override Test ===");
    log("Using Project ID: [" + firebaseConfig.projectId + "]");

    try {
        const app = initializeApp(firebaseConfig);
        log("✅ Init OK");

        const db = getFirestore(app);
        const q = query(collection(db, "Customer"), limit(1));
        const snap = await getDocs(q);
        log("✅ SUCCESS! Found doc count: " + snap.size);

    } catch (e) {
        log("❌ FAIL: " + e.code + " - " + e.message);
    }

    log("=== Done ===");
    process.exit(0);
}

run();
