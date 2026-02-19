/**
 * Intent Detection — WR Smile & Supplies WhatsApp Bot
 * Detects the customer's intent from their message text.
 */
function detectIntent(text) {
    const t = text.toLowerCase();

    // Invoice / bill request
    if (/\b(invoice|bill|receipt|payment)\b/.test(t))
        return 'INVOICE';

    // Price / rate enquiry
    if (/\b(price|rate|cost|how much|quote|fee)\b/.test(t))
        return 'PRICE';

    // Balance / Loan / Payment enquiry
    if (/\b(balance|loan|debt|pay|owe|credit|dues)\b/.test(t))
        return 'BALANCE';

    // Product / item availability
    if (/\b(product|item|sell|available|stock|carry|have)\b/.test(t))
        return 'PRODUCTS';

    // Opening hours
    if (/\b(hour|time|open|close|timing|working|when)\b/.test(t))
        return 'HOURS';

    // Location / address
    if (/\b(location|address|where|direction|map|find you)\b/.test(t))
        return 'LOCATION';

    // Contact / phone number
    if (/\b(contact|phone|number|call|reach)\b/.test(t))
        return 'CONTACT';

    // Offers / discounts
    if (/\b(offer|discount|sale|promo|deal|special)\b/.test(t))
        return 'OFFERS';

    // Greetings
    if (/\b(hi|hello|hey|assalamu|alaikum|salam|good morning|good afternoon|good evening)\b/.test(t))
        return 'GREETING';

    // Thanks
    if (/\b(thank|thanks|thank you|thx|appreciate)\b/.test(t))
        return 'THANKS';

    // Goodbye
    if (/\b(bye|goodbye|see you|later|take care)\b/.test(t))
        return 'GOODBYE';

    return 'GENERAL';
}

module.exports = { detectIntent };
