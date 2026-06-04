/**
 * Group Adder — WR POS WhatsApp Bot
 * Safely auto-adds members from source groups to target group.
 * Limits: 5 adds/day with 30-60s delay between adds.
 */

const DAILY_LIMIT = parseInt(process.env.GROUP_ADD_LIMIT || '5');
const ADD_DELAY_MS = 45000; // 45 seconds between adds
const TARGET_GROUP_NAME = 'smile'; // Must be in the target group name

let addedToday = new Set(); // phone numbers added today
let addCount = 0;
let lastResetDate = new Date().toDateString();
let isProcessing = false;
let pendingAdds = []; // queue of { jid, phone, name }

function resetIfNeeded() {
    const today = new Date().toDateString();
    if (today !== lastResetDate) {
        console.log(`[GroupAdder] Daily reset — added ${addCount} yesterday`);
        addedToday.clear();
        addCount = 0;
        lastResetDate = today;
    }
}

function canAdd() {
    resetIfNeeded();
    return addCount < DAILY_LIMIT;
}

function getRemainingAdds() {
    resetIfNeeded();
    return Math.max(0, DAILY_LIMIT - addCount);
}

function wasAlreadyAdded(phone) {
    return addedToday.has(phone);
}

async function addToQueue(sock, knownGroups, senderJid, pushName) {
    resetIfNeeded();

    const phone = senderJid.replace(/@.*$/, '').replace(/[^0-9]/g, '');
    if (!phone || phone.length < 8) return { success: false, reason: 'invalid_phone' };
    if (addedToday.has(phone)) return { success: false, reason: 'already_added_today' };
    if (addCount >= DAILY_LIMIT) return { success: false, reason: 'daily_limit_reached', remaining: getRemainingAdds() };

    // Find target group (Smile & Supplies)
    let targetJid = null;
    for (const [jid, name] of knownGroups) {
        if (name.toLowerCase().includes(TARGET_GROUP_NAME)) {
            targetJid = jid;
            break;
        }
    }
    if (!targetJid) return { success: false, reason: 'target_group_not_found' };

    // Queue the add
    pendingAdds.push({ jid: targetJid, phone, name: pushName || phone, senderJid });
    console.log(`[GroupAdder] Queued ${pushName || phone} (${pendingAdds.length} pending, ${addCount}/${DAILY_LIMIT} used today)`);

    // Start processing if not already
    if (!isProcessing) processQueue(sock);

    return { success: true, queued: true, position: pendingAdds.length, remaining: getRemainingAdds() };
}

async function processQueue(sock) {
    if (isProcessing || pendingAdds.length === 0) return;
    isProcessing = true;

    while (pendingAdds.length > 0 && addCount < DAILY_LIMIT) {
        const add = pendingAdds.shift();
        resetIfNeeded();
        if (addCount >= DAILY_LIMIT) {
            console.log(`[GroupAdder] Daily limit reached (${DAILY_LIMIT}). ${pendingAdds.length} remaining for tomorrow.`);
            break;
        }

        try {
            console.log(`[GroupAdder] Adding ${add.name} (${add.phone}) to group...`);
            await sock.groupParticipantsUpdate(add.jid, [add.senderJid], 'add');
            addedToday.add(add.phone);
            addCount++;
            console.log(`[GroupAdder] ✅ Added ${add.name} (${addCount}/${DAILY_LIMIT} today)`);
        } catch (e) {
            console.error(`[GroupAdder] ❌ Failed to add ${add.name}: ${e.message}`);
            // If "not group admin" error, stop trying
            if (e.message?.includes('not admin') || e.message?.includes('403')) {
                console.error('[GroupAdder] Bot is not group admin. Stopping adds.');
                pendingAdds = [];
                break;
            }
        }

        // Delay between adds to avoid rate limiting
        if (pendingAdds.length > 0) {
            const delay = ADD_DELAY_MS + Math.random() * 15000; // 45-60s
            console.log(`[GroupAdder] Waiting ${(delay / 1000).toFixed(0)}s before next add...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    isProcessing = false;
}

function getStats() {
    resetIfNeeded();
    return {
        addedToday: addCount,
        dailyLimit: DAILY_LIMIT,
        remaining: getRemainingAdds(),
        pending: pendingAdds.length,
        isProcessing
    };
}

// Reset at midnight
setInterval(resetIfNeeded, 60 * 60 * 1000);

module.exports = { addToQueue, getStats, canAdd, getRemainingAdds };
