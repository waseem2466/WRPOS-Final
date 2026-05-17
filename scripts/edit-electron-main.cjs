const fs = require('fs');

let content = fs.readFileSync('electron-main.cjs', 'utf-8');

// Replacement 1
const search1 = `    async sendMessage(to, message) {
        if (!this.sock || this.state !== 'LINKED') {
            console.warn('[Baileys] Cannot send message: not connected.');
            return null;
        }
        try {
            const jid = to.includes('@') ? to : \`\${to}@s.whatsapp.net\`;
            const result = await this.sock.sendMessage(jid, { text: message });

            // Log outgoing QR message`;

const replace1 = `    async sendMessage(to, message, options = {}) {
        if (!this.sock || this.state !== 'LINKED') {
            console.warn('[Baileys] Cannot send message: not connected.');
            return null;
        }
        try {
            const jid = to.includes('@') ? to : \`\${to}@s.whatsapp.net\`;
            
            let messagePayload;
            if (options.documentUrl) {
                messagePayload = {
                    document: { url: options.documentUrl },
                    mimetype: 'application/pdf',
                    fileName: options.documentName || 'invoice.pdf',
                    caption: message
                };
            } else if (options.imageUrl) {
                messagePayload = {
                    image: { url: options.imageUrl },
                    caption: message
                };
            } else {
                messagePayload = { text: message };
            }

            const result = await this.sock.sendMessage(jid, messagePayload);

            // Log outgoing QR message`;

// Replacement 2
const search2 = `    ipcMain.handle('wa-logout', () => qrBot.logout());
    ipcMain.handle('wa-qr-send', async (e, data) => qrBot.sendMessage(data.to, data.message));
    ipcMain.handle('wa-qr-test', async (e, data) => {`;

const replace2 = `    ipcMain.handle('wa-logout', () => qrBot.logout());
    ipcMain.handle('wa-qr-send', async (e, data) => qrBot.sendMessage(data.to, data.message, { 
        documentUrl: data.documentUrl, 
        documentName: data.documentName 
    }));
    ipcMain.handle('wa-qr-test', async (e, data) => {`;

// Replacement 3
const search3 = `    ipcMain.handle('wa-cloud-send', async (e, data) => {
        try {
            const token = data.token || process.env.WHATSAPP_TOKEN;
            const phoneNumberId = data.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
            const appSecret = process.env.WHATSAPP_APP_SECRET;

            if (!token || !phoneNumberId) {
                return { success: false, error: 'WhatsApp Cloud credentials missing' };
            }

            const proof = getAppSecretProof(token, appSecret);
            const url = \`https://graph.facebook.com/v18.0/\${phoneNumberId}/messages\${proof ? \`?appsecret_proof=\${proof}\` : ''}\`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': \`Bearer \${token}\`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: data.to,
                    type: "text",
                    text: { body: data.message }
                })
            });`;

const replace3 = `    ipcMain.handle('wa-cloud-send', async (e, data) => {
        try {
            const token = data.token || process.env.WHATSAPP_TOKEN;
            const phoneNumberId = data.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
            const appSecret = process.env.WHATSAPP_APP_SECRET;

            if (!token || !phoneNumberId) {
                return { success: false, error: 'WhatsApp Cloud credentials missing' };
            }

            const proof = getAppSecretProof(token, appSecret);
            const url = \`https://graph.facebook.com/v18.0/\${phoneNumberId}/messages\${proof ? \`?appsecret_proof=\${proof}\` : ''}\`;
            
            let payloadBody;
            if (data.documentUrl) {
                payloadBody = {
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: data.to,
                    type: "document",
                    document: { 
                        link: data.documentUrl,
                        filename: data.documentName || 'invoice.pdf',
                        caption: data.message 
                    }
                };
            } else {
                payloadBody = {
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: data.to,
                    type: "text",
                    text: { body: data.message }
                };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': \`Bearer \${token}\`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payloadBody)
            });`;

content = content.replace(search1, replace1);
content = content.replace(search2, replace2);
content = content.replace(search3, replace3);

fs.writeFileSync('electron-main.cjs', content, 'utf-8');
console.log('Edits applied successfully.');
