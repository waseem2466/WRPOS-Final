
import React, { useEffect } from 'react';
import { AICommander } from '../services/AICommander';
import { dbPool } from '../services/db';
import { errorHandler } from '../services/errorHandler';

interface MessagePayload {
    id: string;
    from: string;
    text: string;
    method: 'qr' | 'cloud';
}

export const AutoResponder: React.FC = () => {
    useEffect(() => {
        const handleMessage = async (data: MessagePayload) => {
            if (!data.text || !data.from) return;

            try {
                // 1. Parse Intent
                console.log(`[AutoResponder] Processing message from ${data.from}: ${data.text}`);
                const intent = await AICommander.parseUserIntent(data.text);
                console.log(`[AutoResponder] Detected Intent: ${intent.type}`, intent.payload);

                // 2. Tag Customer based on Intent
                let tag = '';
                switch (intent.type) {
                    case 'BILLING_ADD': tag = 'Billing'; break;
                    case 'INVENTORY_SEARCH': tag = 'Sales'; break;
                    case 'ANALYTICS': tag = 'Analytics'; break;
                    case 'CUSTOMER_SEARCH': tag = 'Support'; break;
                }

                if (tag) {
                    await tagCustomer(data.from, tag);
                }

                // AI replies are now handled centraly in the Electron Main process 
                // for "Always On" capability (even when not logged in).
                // AutoResponder now only handles passive tasks like customer tagging.

            } catch (error) {
                errorHandler.log('AutoResponder', error instanceof Error ? error : new Error(String(error)), { from: data.from }, 'medium');
            }
        };

        // Listeners
        const cleanupQr = window.electronAPI?.onWaQrMessage?.(handleMessage);
        const cleanupCloud = window.electronAPI?.onWaCloudMessage?.(handleMessage);

        console.log('[AutoResponder] Active and listening...');

        return () => {
            // Cleanup if architecture supports method removal, 
            // though current preload might not return unsubscribe for all.
            // Based on preload inspection: `on` returns a cleanup function.
            if (typeof cleanupQr === 'function') cleanupQr();
            if (typeof cleanupCloud === 'function') cleanupCloud();
        };
    }, []);

    return null; // Headless component
};

async function tagCustomer(phone: string, tag: string) {
    try {
        // Idempotent tag update
        const query = `
            UPDATE "Customer"
            SET tags = array_append(COALESCE(tags, '{}'), $2)
            WHERE phone = $1 AND NOT ($2 = ANY(COALESCE(tags, '{}')))
        `;
        await dbPool.query(query, [phone, tag]);
        console.log(`[AutoResponder] Tagged ${phone} with ${tag}`);
    } catch (e) {
        console.error('[AutoResponder] Tagging failed:', e);
    }
}
