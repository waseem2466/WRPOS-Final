import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    setDoc,
    Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

const isElectron = typeof window !== 'undefined' && Boolean((window as any).electronAPI);

export const cloudDb = {
    // Sync any data to Firestore
    syncToCloud: async (collectionName: string, id: string, data: any) => {
        if (isElectron) return { success: true }; // Desktop sync uses local DB/Neon, not Firestore WebChannel.
        if (!db) return { success: true }; // Firebase disabled
        try {
            const docRef = doc(db, collectionName, id);
            await setDoc(docRef, {
                ...data,
                updated_at: Timestamp.now()
            }, { merge: true });
            return { success: true };
        } catch (err) {
            console.error(`[CloudDB] Sync failed for ${collectionName}/${id}:`, err);
            return { success: false, error: err };
        }
    },

    // Fetch data from Firestore
    getFromCloud: async (collectionName: string, id: string) => {
        if (isElectron) return null;
        if (!db) return null; // Firebase disabled
        try {
            const docRef = doc(db, collectionName, id);
            // Using getDoc would require importing it, let's keep it simple for now or implement as needed
            // For brevity, we'll implement full CRUD here later.
            return null;
        } catch (err) {
            return null;
        }
    },

    // Upload file to Firebase Storage
    uploadFile: async (path: string, file: Blob | Uint8Array) => {
        try {
            if (!storage) {
                throw new Error('Firebase Storage is not configured');
            }
            const storageRef = ref(storage, path);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            return { success: true, url };
        } catch (err) {
            console.error(`[CloudStorage] Upload failed for ${path}:`, err);
            return { success: false, error: err };
        }
    }
};

