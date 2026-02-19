import { BusinessSettings } from '../types';
import { errorHandler } from './errorHandler';

export const smsService = {
    sendSMS: async (to: string, message: string): Promise<{ success: boolean; error?: string }> => {
        try {
            return await (window as any).electronAPI.smsGatewaySend({ to, message });
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            errorHandler.log('SMS', err, { operation: 'sendSMS', to }, 'high');
            return { success: false, error: err.message };
        }
    },

    saveConfig: async (config: { url: string; token: string; globalToken: string }): Promise<{ success: boolean; error?: string }> => {
        try {
            return await (window as any).electronAPI.smsGatewaySave(config);
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            errorHandler.log('SMS', err, { operation: 'saveConfig' }, 'medium');
            return { success: false, error: err.message };
        }
    },

    getConfig: async (): Promise<{ url: string; token: string; globalToken: string }> => {
        try {
            return await (window as any).electronAPI.smsGatewayGet();
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            errorHandler.log('SMS', err, { operation: 'getConfig' }, 'low');
            return { url: '', token: '', globalToken: '' };
        }
    },

    verifyConnection: async (settings: BusinessSettings): Promise<boolean> => {
        if (!settings.smsGatewayUrl || !settings.smsGatewayToken) return false;
        try {
            const result = await smsService.sendSMS("94719336848", `✅ ${settings.businessName}: SMS Gateway Connection Verified!`);
            return result.success;
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            errorHandler.log('SMS', err, { operation: 'verifyConnection' }, 'medium');
            return false;
        }
    }
};
