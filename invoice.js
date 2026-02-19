/**
 * Invoice Generator — WR Smile & Supplies
 */
const shop = require('./shopData');

function generateInvoice(customer) {
    const customerName = customer.name || 'Valued Customer';
    const amountDue = customer.amount ? `Rs. ${customer.amount}` : 'TBD';
    const invoiceNumber = customer.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    return `🧾 *INVOICE #${invoiceNumber}*
━━━━━━━━━━━━━━━━━━
🏪 ${shop.shopName}
📍 ${shop.address}
📞 ${shop.phoneNumbers[0]}
━━━━━━━━━━━━━━━━━━
📅 Date: ${date}
👤 Customer: ${customerName}
💰 Amount Due: *${amountDue}*
━━━━━━━━━━━━━━━━━━
💳 Payment Options:
• Cash
• Bank Transfer
• QR Payment (scan at counter)
━━━━━━━━━━━━━━━━━━
Thank you for shopping with us! 🙏`;
}

module.exports = { generateInvoice };
