
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    version: process.versions.electron,
    // Database Bridge
    dbQuery: (text, params, clientId) => ipcRenderer.invoke('db-query', { text, params, clientId }),
    dbConnect: () => ipcRenderer.invoke('db-connect'),
    dbRelease: (clientId) => ipcRenderer.invoke('db-release', clientId),
    // Auth Bridge (Hashing/Comparison done in Main Process to avoid bcryptjs issues)
    authHash: (password) => ipcRenderer.invoke('auth-hash', password),
    authCompare: (password, hash) => ipcRenderer.invoke('auth-compare', password, hash),
    // WhatsApp Bot Bridge
    waGetStatus: () => ipcRenderer.invoke('wa-get-status'),
    waLink: () => ipcRenderer.invoke('wa-link'),
    waLogout: () => ipcRenderer.invoke('wa-logout'),
    waResetSession: () => ipcRenderer.invoke('wa-reset-session'),
    onWaStatusUpdate: (callback) => {
        const sub = (_, data) => callback(data);
        ipcRenderer.on('wa-status-update', sub);
        return () => ipcRenderer.removeListener('wa-status-update', sub);
    },
    onWaBotReply: (callback) => {
        const sub = (_, data) => callback(data);
        ipcRenderer.on('wa-bot-reply', sub);
        return () => ipcRenderer.removeListener('wa-bot-reply', sub);
    },
    onWaMessage: (callback) => {
        const sub = (_, data) => callback(data);
        ipcRenderer.on('wa-message', sub);
        return () => ipcRenderer.removeListener('wa-message', sub);
    },
    onWaMessageStatus: (callback) => {
        const sub = (_, data) => callback(data);
        ipcRenderer.on('wa-message-status', sub);
        return () => ipcRenderer.removeListener('wa-message-status', sub);
    },
    // WhatsApp Cloud API Bridge
    waCloudGet: () => ipcRenderer.invoke('wa-cloud-get'),
    waCloudSave: (config) => ipcRenderer.invoke('wa-cloud-save', config),
    waCloudSend: (payload) => ipcRenderer.invoke('wa-cloud-send', payload),
    waCloudSendTemplate: (payload) => ipcRenderer.invoke('wa-cloud-send-template', payload),
    waCloudGetHistory: (options) => ipcRenderer.invoke('wa-cloud-get-history', options || {}),
    waSetBotState: (active) => ipcRenderer.invoke('wa-set-bot-state', active),
    waGetBotConfig: () => ipcRenderer.invoke('wa-get-bot-config'),
    waGetBotStatusDebug: () => ipcRenderer.invoke('wa-get-bot-status-debug'),
    waSetBotProvider: (provider) => ipcRenderer.invoke('wa-set-bot-provider', provider),
    onWaCloudMessage: (callback) => {
        const sub = (_, data) => callback(data);
        ipcRenderer.on('wa-cloud-message', sub);
        return () => ipcRenderer.removeListener('wa-cloud-message', sub);
    },
    onWaCloudStatus: (callback) => {
        const sub = (_, data) => callback(data);
        ipcRenderer.on('wa-cloud-status', sub);
        return () => ipcRenderer.removeListener('wa-cloud-status', sub);
    },
    waGetWebhookUrl: () => ipcRenderer.invoke('wa-get-webhook-url'),
    // QR Bot Additional Bridge
    waQrSend: (payload) => ipcRenderer.invoke('wa-qr-send', payload),
    waRelaySend: (payload) => ipcRenderer.invoke('wa-relay-send', payload),
    waQrTest: (payload) => ipcRenderer.invoke('wa-qr-test', payload),
    onWaQrMessage: (callback) => {
        const sub = (_, data) => callback(data);
        ipcRenderer.on('wa-qr-message', sub);
        return () => ipcRenderer.removeListener('wa-qr-message', sub);
    },
    // SMS Gateway Bridge
    smsGatewayGet: () => ipcRenderer.invoke('sms-gateway-get'),
    smsGatewaySave: (config) => ipcRenderer.invoke('sms-gateway-save', config),
    smsGatewaySend: (payload) => ipcRenderer.invoke('sms-gateway-send', payload),
    // Generic Event Listener
    on: (channel, callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
    },
    // File operations
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),

    // AI Bridge
    askAI: (prompt, model) => ipcRenderer.invoke('ask-ai', { prompt, model }),
});

window.addEventListener('DOMContentLoaded', () => {
    console.log('%c[WR POS]%c Desktop Bridge Active', 'color: #3b82f6; font-weight: bold', 'color: inherit');
});
