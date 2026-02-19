const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');
const { getAuth } = require('firebase/auth');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
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

async function runDiagnostics() {
    console.log("=== WR POS Firebase Diagnostics ===");
    console.log("Time:", new Date().toISOString());
    console.log("Project ID:", firebaseConfig.projectId);
    console.log("-----------------------------------");

    // 1. Check Env Vars
    console.log("[1/3] Checking Environment Variables...");
    const missing = Object.entries(firebaseConfig)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (missing.length > 0) {
        console.error("❌ Missing variables:", missing.join(", "));
    } else {
        console.log("✅ All Firebase environment variables are present.");
    }

    // 2. Initialize App
    console.log("[2/3] Initializing Firebase App...");
    let app;
    try {
        app = initializeApp(firebaseConfig);
        console.log("✅ Firebase App initialized successfully.");
    } catch (err) {
        console.error("❌ Failed to initialize Firebase App:", err.message);
        return;
    }

    // 3. Test Firestore
    console.log("[3/3] Testing Firestore Connectivity...");
    try {
        const db = getFirestore(app);
        // We look for any data in any collection to verify read access
        // Common collections: "Customer", "orders", "Settings"
        const testCollections = ["Customer", "orders", "Settings", "test_connection"];

        let success = false;
        for (const collName of testCollections) {
            try {
                const q = query(collection(db, collName), limit(1));
                const snapshot = await getDocs(q);
                console.log(`📡 Collection '${collName}': reached (Found ${snapshot.size} docs)`);
                success = true;
            } catch (e) {
                // Ignore errors for individual collections if others work
            }
        }

        if (success) {
            console.log("✅ Firestore: Connection and read access verified.");
        } else {
            console.warn("⚠️ Firestore: Reached, but could not read from common collections. Check security rules?");
        }
    } catch (err) {
        console.error("❌ Firestore Error:", err.message);
    }

    console.log("-----------------------------------");
    console.log("Diagnostics Complete.");
}

runDiagnostics().catch(console.error);
