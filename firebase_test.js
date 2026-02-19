const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const dotenv = require('dotenv');
const path = require('path');

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

async function testFirebase() {
    console.log("Testing Firebase connection with project:", firebaseConfig.projectId);
    try {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        // Try to list a collection (even if empty, it should not throw if connected)
        console.log("Attempting to reach Firestore...");
        const querySnapshot = await getDocs(collection(db, "test_connection"));
        console.log("✅ Firebase Firestore: Successfully reached (Found " + querySnapshot.size + " docs in test collection)");

        process.exit(0);
    } catch (err) {
        console.error("❌ Firebase Error:", err.message);
        process.exit(1);
    }
}

testFirebase();
