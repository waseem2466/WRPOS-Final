const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');
const fs = require('fs');
const dotenv = require('dotenv');
const path = require('path');

const logFile = path.join(__dirname, 'firebase_diag_v3.log');
function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

dotenv.config({ path: path.join(__dirname, '.env') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

async function run() {
    log("=== Firebase Diagnostic V3 ===");
    log("Landed Project ID: [" + firebaseConfig.projectId + "]");
    log("API Key found: " + (firebaseConfig.apiKey ? "YES" : "NO"));
    log("-----------------------------------");

    try {
        const app = initializeApp(firebaseConfig);
        log("✅ App Init OK");

        const db = getFirestore(app);
        log("📡 Reaching Firestore...");

        try {
            log("🔍 Checking public collection 'test_connection'...");
            const qTest = query(collection(db, "test_connection"), limit(1));
            const snapTest = await getDocs(qTest);
            log("✅ Public Read OK (Found " + snapTest.size + " docs)");
        } catch (e) {
            log("⚠️ Test Collection Fail: " + e.code + " - " + e.message);
        }

        try {
            log("🔍 Checking main 'Customer' collection...");
            const q = query(collection(db, "Customer"), limit(1));
            const snap = await getDocs(q);
            log("✅ Firestore Read OK (Found " + snap.size + " docs)");
        } catch (e) {
            log("❌ Main Read Fail: " + e.code + " - " + e.message);
        }

    } catch (e) {
        log("❌ GLOBAL FAIL: " + e.message);
    }

    log("=== Done ===");
    process.exit(0);
}

run();
