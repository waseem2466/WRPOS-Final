import { messaging } from "./firebase";
import { getToken, onMessage } from "firebase/messaging";

export const notificationService = {
    // Request permission and get token
    initNotifications: async (vapidKey: string) => {
        try {
            const msg = await messaging();
            if (!msg) return null;

            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const token = await getToken(msg, { vapidKey });
                console.log('[FCM] Token:', token);
                return token;
            }
            return null;
        } catch (err) {
            console.error('[FCM] Init failed:', err);
            return null;
        }
    },

    // Listen for foreground messages
    onForegroundMessage: async (callback: (payload: any) => void) => {
        const msg = await messaging();
        if (!msg) return;

        onMessage(msg, (payload) => {
            console.log('[FCM] Message received:', payload);
            callback(payload);
        });
    }
};
