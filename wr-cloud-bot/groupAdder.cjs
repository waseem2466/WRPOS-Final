/**
 * Group Inviter — WR POS WhatsApp Bot
 * Sends DM with group link to members from source groups.
 * Limits: 20 DMs/day with 30-60s delay between sends.
 */

const DAILY_LIMIT = parseInt(process.env.GROUP_INVITE_LIMIT || '20');
const SEND_DELAY_MS = 35000; // 35 seconds between DMs
const GROUP_LINK = 'https://chat.whatsapp.com/K7ALigMk9ad4SBlcRUqoxX?mode=wwt';

let sentToday = new Set();
let sendCount = 0;
let lastResetDate = new Date().toDateString();
let isProcessing = false;
let pendingInvites = [];

function resetIfNeeded() {
    const today = new Date().toDateString();
    if (today !== lastResetDate) {
        console.log(`[GroupInviter] Daily reset — sent ${sendCount} invites yesterday`);
        sentToday.clear();
        sendCount = 0;
        lastResetDate = today;
    }
}

function canSend() {
    resetIfNeeded();
    return sendCount < DAILY_LIMIT;
}

function getRemaining() {
    resetIfNeeded();
    return Math.max(0, DAILY_LIMIT - sendCount);
}

function wasAlreadyInvited(phone) {
    return sentToday.has(phone);
}

async function queueInvite(sock, senderJid, pushName) {
    resetIfNeeded();

    const phone = senderJid.replace(/@.*$/, '').replace(/[^0-9]/g, '');
    if (!phone || phone.length < 8) return { success: false, reason: 'invalid_phone' };
    if (sentToday.has(phone)) return { success: false, reason: 'already_invited_today' };
    if (sendCount >= DAILY_LIMIT) return { success: false, reason: 'daily_limit_reached', remaining: getRemaining() };

    pendingInvites.push({ senderJid, phone, name: pushName || phone });
    console.log(`[GroupInviter] Queued ${pushName || phone} (${pendingInvites.length} pending, ${sendCount}/${DAILY_LIMIT} used today)`);

    if (!isProcessing) processQueue(sock);

    return { success: true, queued: true, position: pendingInvites.length, remaining: getRemaining() };
}

async function processQueue(sock) {
    if (isProcessing || pendingInvites.length === 0) return;
    isProcessing = true;

    while (pendingInvites.length > 0 && sendCount < DAILY_LIMIT) {
        const invite = pendingInvites.shift();
        resetIfNeeded();
        if (sendCount >= DAILY_LIMIT) {
            console.log(`[GroupInviter] Daily limit reached (${DAILY_LIMIT}). ${pendingInvites.length} remaining for tomorrow.`);
            break;
        }

        const msg = `Hi ${invite.name}! 👋\n\n` +
            `We noticed you're in a local community group. ` +
            `We'd love to have you in our *Smile & Supplies* WhatsApp group!\n\n` +
            `🛍️ *What we offer:*\n` +
            `• Phone accessories\n` +
            `• Kitchen appliances\n` +
            `• Stationery & cosmetics\n` +
            `• Gifts & ornaments\n` +
            `• Daily deals & discounts\n\n` +
            `👇 *Tap the link to join:*\n` +
            `${GROUP_LINK}\n\n` +
            `See you there! 🎉`;

        try {
            console.log(`[GroupInviter] Sending invite to ${invite.name} (${invite.phone})...`);
            await sock.sendMessage(invite.senderJid, { text: msg });
            sentToday.add(invite.phone);
            sendCount++;
            console.log(`[GroupInviter] ✅ Sent to ${invite.name} (${sendCount}/${DAILY_LIMIT} today)`);
        } catch (e) {
            console.error(`[GroupInviter] ❌ Failed to send to ${invite.name}: ${e.message}`);
        }

        if (pendingInvites.length > 0) {
            const delay = SEND_DELAY_MS + Math.random() * 25000; // 35-60s
            console.log(`[GroupInviter] Waiting ${(delay / 1000).toFixed(0)}s before next DM...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    isProcessing = false;
}

function getStats() {
    resetIfNeeded();
    return {
        sentToday: sendCount,
        dailyLimit: DAILY_LIMIT,
        remaining: getRemaining(),
        pending: pendingInvites.length,
        isProcessing
    };
}

setInterval(resetIfNeeded, 60 * 60 * 1000);

module.exports = { queueInvite, getStats, canSend, getRemaining };
