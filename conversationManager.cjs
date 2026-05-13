/**
 * Conversation Manager — Multi-turn WhatsApp interactions
 * Maintains state for customers asking about loans/openclaw
 */

const { searchCustomer, extractPhoneFromText, getLoanDetails } = require('./dbHelper.cjs');

// In-memory conversation state: { customerPhone: { step, data, timestamp } }
const conversationState = new Map();

// Cleanup old conversations after 5 minutes
const CONVERSATION_TIMEOUT = 5 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of conversationState.entries()) {
        if (now - value.timestamp > CONVERSATION_TIMEOUT) {
            conversationState.delete(key);
            console.log(`[ConversationManager] Cleared stale conversation for ${key}`);
        }
    }
}, 60000); // Check every minute

/**
 * Get or initialize conversation state for a customer
 */
function getConversationState(phoneNumber) {
    if (!conversationState.has(phoneNumber)) {
        conversationState.set(phoneNumber, {
            step: 'INITIAL',
            data: {},
            timestamp: Date.now()
        });
    } else {
        // Update timestamp for active conversation
        conversationState.get(phoneNumber).timestamp = Date.now();
    }
    return conversationState.get(phoneNumber);
}

/**
 * Handle LOAN_INQUIRY intent with multi-turn conversation
 */
async function handleLoanInquiry(customerPhone, messageText) {
    const state = getConversationState(customerPhone);
    const extractedPhone = extractPhoneFromText(messageText);

    console.log(`[ConversationManager] Loan Inquiry - Step: ${state.step}, Extracted Phone: ${extractedPhone}`);

    // Step 1: Ask for phone number if not provided
    if (!extractedPhone && !state.data.confirmedPhone) {
        state.step = 'AWAITING_PHONE';
        return {
            reply: `Hello! 👋 To check your loan and OpenClaw details, please share your 10-digit phone number registered with us. (e.g., 0712345678)`,
            handled: true
        };
    }

    // Step 2: Extract phone from message
    const phoneToCheck = extractedPhone || state.data.confirmedPhone;

    if (phoneToCheck && state.step === 'AWAITING_PHONE') {
        state.data.confirmedPhone = phoneToCheck;
        state.step = 'CONFIRMING_PHONE';
        return {
            reply: `Is this your number? ${phoneToCheck}\n\nPlease reply with "Yes" or "Correct" to confirm.`,
            handled: true
        };
    }

    // Step 3: Confirm phone and fetch details
    if (state.step === 'CONFIRMING_PHONE' && /\b(yes|correct|that's|confirm|right)\b/i.test(messageText)) {
        const phone = state.data.confirmedPhone;

        try {
            const customer = await searchCustomer(phone);

            if (!customer) {
                state.step = 'INITIAL';
                conversationState.delete(customerPhone);
                return {
                    reply: `Sorry, I couldn't find a customer account with that number. Please check and try again, or contact us at 0701234567.`,
                    handled: true
                };
            }

            // Fetch detailed loan info
            const details = await getLoanDetails(customer.id);
            state.step = 'COMPLETED';

            return {
                reply: details.formatted + `\n\n📞 For more info, call us at 0701234567`,
                handled: true,
                customerData: customer
            };
        } catch (err) {
            console.error('[ConversationManager] Error fetching loan details:', err.message);
            state.step = 'INITIAL';
            conversationState.delete(customerPhone);
            return {
                reply: `Sorry, I'm having trouble checking your account. Please try again later or call us at 0701234567.`,
                handled: true
            };
        }
    }

    // If none of the above, go back to asking for phone
    if (!state.data.confirmedPhone) {
        state.step = 'AWAITING_PHONE';
        return {
            reply: `To check your loan and OpenClaw details, please share your phone number. (e.g., 0712345678)`,
            handled: true
        };
    }

    return { handled: false };
}

/**
 * Handle BALANCE_CHECK intent
 */
async function handleBalanceCheck(customerPhone, messageText) {
    const state = getConversationState(customerPhone);
    const extractedPhone = extractPhoneFromText(messageText);

    console.log(`[ConversationManager] Balance Check - Step: ${state.step}`);

    // Ask for phone if not provided
    if (!extractedPhone && !state.data.confirmedPhone) {
        state.step = 'AWAITING_PHONE';
        return {
            reply: `Hi! To check your balance, please share your phone number registered with us.`,
            handled: true
        };
    }

    const phoneToCheck = extractedPhone || state.data.confirmedPhone;

    if (phoneToCheck && state.step === 'AWAITING_PHONE') {
        state.data.confirmedPhone = phoneToCheck;
        state.step = 'CONFIRMING_PHONE';
        return {
            reply: `Confirm this number: ${phoneToCheck}?\n\nReply "Yes" to proceed.`,
            handled: true
        };
    }

    if (state.step === 'CONFIRMING_PHONE' && /\b(yes|correct|confirm)\b/i.test(messageText)) {
        const phone = state.data.confirmedPhone;

        try {
            const customer = await searchCustomer(phone);

            if (!customer) {
                conversationState.delete(customerPhone);
                return {
                    reply: `Account not found. Please verify your number or contact us.`,
                    handled: true
                };
            }

            const msg = `*${customer.name}*\n📊 Your Balance: Rs. ${customer.balance}\nOutstanding: Rs. ${customer.balance}`;
            state.step = 'COMPLETED';

            return {
                reply: msg + `\n\n💬 Reply "Loan" for full loan details.`,
                handled: true,
                customerData: customer
            };
        } catch (err) {
            console.error('[ConversationManager] Balance check error:', err.message);
            conversationState.delete(customerPhone);
            return {
                reply: `Error fetching balance. Please try again.`,
                handled: true
            };
        }
    }

    return { handled: false };
}

/**
 * Clear conversation state (on logout or reset)
 */
function clearConversation(phoneNumber) {
    conversationState.delete(phoneNumber);
    console.log(`[ConversationManager] Cleared conversation for ${phoneNumber}`);
}

module.exports = {
    handleLoanInquiry,
    handleBalanceCheck,
    getConversationState,
    clearConversation
};
