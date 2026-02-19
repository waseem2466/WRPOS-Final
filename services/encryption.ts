import CryptoJS from 'crypto-js';
import { errorHandler } from './errorHandler';
import { ensureSafeUTF8 } from './stringUtils';

const ENCRYPTION_KEY = import.meta.env.VITE_DB_ENCRYPTION_KEY || 'wr-pos-default-encryption-key-v1';

export const encryptData = (data: string): string => {
    try {
        const safeData = ensureSafeUTF8(data);
        return CryptoJS.AES.encrypt(safeData, ENCRYPTION_KEY).toString();
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        errorHandler.log('Encryption', err, { operation: 'encryptData' }, 'critical');
        throw err;
    }
};

export const decryptData = (ciphertext: string): string => {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        // Lower severity as this often happens with legacy/unencrypted data in localStorage
        errorHandler.log('Encryption', err, { operation: 'decryptData' }, 'medium');
        throw err;
    }
};

export const encryptObject = <T>(obj: T): string => {
    try {
        return encryptData(JSON.stringify(obj));
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        errorHandler.log('Encryption', err, { operation: 'encryptObject' }, 'critical');
        throw err;
    }
};

export const decryptObject = <T>(ciphertext: string): T | null => {
    try {
        const decrypted = decryptData(ciphertext);
        return JSON.parse(decrypted) as T;
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        errorHandler.log('Encryption', err, { operation: 'decryptObject' }, 'medium');
        return null;
    }
};
