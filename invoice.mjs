export function generateInvoice(customer) {
    const customerName = customer.name || 'Valued Customer';
    const amountDue = customer.amount ? `Rs. ${customer.amount}` : '0.00';
    const invoiceNumber = customer.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    return `
🧾 *INVOICE #${invoiceNumber}* - Date: ${date}

Customer: ${customerName}
Amount Due: *${amountDue}*

Payment Options:
• Cash
• Bank Transfer (Account: XXXX-XXXX-XXXX)
• QR Payment (Scan at counter)

Thank you for your business! 🙏
`;
}
