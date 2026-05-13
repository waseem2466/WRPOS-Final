import { initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getVertexAI } from "firebase/vertexai-preview";
import type { FirebaseApp } from "firebase/app";


const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAj4DCMAs_Gcnvq2mg10rdtdgZtnbNQU0Y",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "wr-web-fec66.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "wr-web-fec66",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "wr-web-fec66.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "386363692786",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:386363692786:web:539b919c826d1af37ba26b",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-RHX9L39NVM"
};

export const isFirebaseConfigured = Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

// Initialize Firebase only when the client config is present.
const app: FirebaseApp | null = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

// Initialize services
export const auth: Auth | null = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage: FirebaseStorage | null = app ? getStorage(app) : null;
export const vertexAI = app ? getVertexAI(app) : null;


// Analytics and Messaging (check support)
export const analytics = async () => {
    if (!app) return null;
    const supported = await isAnalyticsSupported();
    return supported ? getAnalytics(app) : null;
};

export const messaging = async () => {
    if (!app) return null;
    const supported = await isSupported();
    return supported ? getMessaging(app) : null;
};

export default app;

