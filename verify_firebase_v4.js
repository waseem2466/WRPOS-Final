const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');
const fs = require('fs');
const dotenv = require('dotenv');
const path = require('path');

const logFile = path.join(__dirname, 'firebase_diag_FINAL_TEST.log');
function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\r\n');
}

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
    log("=== Firebase Diagnostic FINAL TEST ===");
    log("Project ID: [" + firebaseConfig.projectId + "]");
    log("API Key present: " + (!!firebaseConfig.apiKey));

    try {
        const app = initializeApp(firebaseConfig);
        log("✅ App Initialized");

        const db = getFirestore(app);
        log("📡 Reaching Firestore...");

        try {
            log("🔍 Check 'test_connection'...");
            const q = query(collection(db, "test_connection"), limit(1));
            const snap = await getDocs(q);
            log("✅ SUCCESS! Found doc count: " + snap.size);
        } catch (e) {
            log("❌ Permission Error: " + e.code);
            log("Details: " + e.message);
        }

    } catch (e) {
        log("❌ CRITICAL FAIL: " + e.message);
    }

    log("=== Audit Complete ===");
    process.exit(0);
}

run();
