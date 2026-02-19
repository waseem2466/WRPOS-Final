const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
const logFile = path.join(__dirname, 'VERIFY_NEW_LOG.txt');

function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

log("--- Definitive Verification ---");
log("Current Dir: " + __dirname);

try {
    const envRaw = fs.readFileSync(envPath, 'utf8');
    log(".env File Length: " + envRaw.length);
    log(".env contains wrpos-live: " + envRaw.includes('wrpos-live'));

    dotenv.config({ path: envPath });
    log("Loaded Project ID: [" + process.env.VITE_FIREBASE_PROJECT_ID + "]");

    const { initializeApp } = require('firebase/app');
    const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

    const firebaseConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
    };

    const app = initializeApp(firebaseConfig);
    log("✅ App Init OK");

    const db = getFirestore(app);
    const q = query(collection(db, "Customer"), limit(1));
    getDocs(q).then(snap => {
        log("✅ SUCCESS! Found doc count: " + snap.size);
        process.exit(0);
    }).catch(e => {
        log("❌ FAIL: " + e.message);
        process.exit(1);
    });

} catch (e) {
    log("❌ CRITICAL ERROR: " + e.message);
    process.exit(1);
}
