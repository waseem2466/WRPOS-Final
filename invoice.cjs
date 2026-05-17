/**
 * Invoice Generator (PDF & Text) — WR Smile & Supplies
 */
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const shop = require('./shopData.cjs');

/**
 * Original text-based invoice (kept for logging or fallback)
 */
function generateInvoice(customer) {
    const customerName = customer.name || 'Valued Customer';
    const amountDue = customer.amount ? `Rs. ${customer.amount}` : 'TBD';
    const invoiceNumber = customer.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    return `🧾 *INVOICE #${invoiceNumber}*
━━━━━━━━━━━━━━━━━━
🏪 ${shop.shopName}
📍 ${shop.address}
━━━━━━━━━━━━━━━━━━
📅 Date: ${date}
👤 Customer: ${customerName}
💰 Amount Due: *${amountDue}*
━━━━━━━━━━━━━━━━━━
Thank you for shopping with us! 🙏`;
}

/**
 * Generates a professional PDF invoice as a Buffer
 */
async function generatePDFInvoice(customer) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const date = new Date().toLocaleDateString();
    const invNum = customer.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(11, 17, 33);
    doc.text(shop.shopName.toUpperCase(), pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(shop.address, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Contact: ${shop.phoneNumbers.join(' / ')}`, pageWidth / 2, 33, { align: 'center' });

    doc.setDrawColor(200, 200, 200);
    doc.line(15, 40, pageWidth - 15, 40);

    // Invoice Meta
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("OFFICIAL INVOICE", 15, 50);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice No: #${invNum}`, 15, 58);
    doc.text(`Date: ${date}`, 15, 63);

    // Customer Info
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO:", pageWidth - 70, 50);
    doc.setFont("helvetica", "normal");
    doc.text(customer.name || 'Valued Customer', pageWidth - 70, 58);
    doc.text(customer.phone || 'N/A', pageWidth - 70, 63);

    // Items Placeholder (For AI-generated invoices, we usually summarize)
    const items = customer.items || [
        { name: 'General Merchandise', qty: 1, price: customer.amount || 0 }
    ];

    const tableData = items.map(item => [
        item.name,
        item.qty || 1,
        `Rs. ${item.price.toLocaleString()}`,
        `Rs. ${(item.price * (item.qty || 1)).toLocaleString()}`
    ]);

    doc.autoTable({
        startY: 80,
        head: [['Item Description', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [11, 17, 33], textColor: [255, 255, 255] },
        margin: { left: 15, right: 15 }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    
    // Total
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL DUE:`, pageWidth - 70, finalY);
    doc.text(`Rs. ${(customer.amount || 0).toLocaleString()}`, pageWidth - 15, finalY, { align: 'right' });

    // Footer
    const footerY = doc.internal.pageSize.height - 30;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for your business! This is a computer-generated invoice.", pageWidth / 2, footerY, { align: 'center' });
    doc.text("Software Powered by WR POS", pageWidth / 2, footerY + 5, { align: 'center' });

    // Return as Buffer
    return Buffer.from(doc.output('arraybuffer'));
}

module.exports = { generateInvoice, generatePDFInvoice };
