
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Bill, BusinessSettings, Customer } from '../types';
import { errorHandler } from './errorHandler';


export const pdfService = {
    generateInvoice: async (bill: Bill, settings: BusinessSettings, customer?: Customer): Promise<void> => {
        try {
        const doc = new jsPDF() as any;

        const pageWidth = doc.internal.pageSize.width;

        // Header
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text(settings.businessName.toUpperCase(), pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(settings.address, pageWidth / 2, 28, { align: 'center' });
        doc.text(`Contact: ${settings.contactPhone}`, pageWidth / 2, 33, { align: 'center' });

        doc.setDrawColor(200, 200, 200);
        doc.line(15, 40, pageWidth - 15, 40);

        // Invoice Info
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("INVOICE", 15, 50);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Number: #${bill.invoiceNumber}`, 15, 58);
        doc.text(`Date: ${new Date(bill.date).toLocaleDateString()}`, 15, 63);
        doc.text(`Payment: ${bill.paymentType}`, 15, 68);

        // Customer Info
        if (customer) {
            doc.setFont("helvetica", "bold");
            doc.text("BILL TO:", pageWidth - 70, 50);
            doc.setFont("helvetica", "normal");
            doc.text(customer.name, pageWidth - 70, 58);
            doc.text(customer.phone, pageWidth - 70, 63);
            if (customer.address) {
                doc.text(customer.address, pageWidth - 70, 68, { maxWidth: 55 });
            }
        }

        // Items Table
        const tableData = bill.items.map(item => [
            item.name,
            item.quantity,
            `LKR ${item.price.toLocaleString()}`,
            `LKR ${(item.discountValue || 0).toLocaleString()}`,
            `LKR ${((item.price - (item.discountValue || 0)) * item.quantity).toLocaleString()}`
        ]);

        doc.autoTable({
            startY: 80,
            head: [['Product / Service', 'Qty', 'Unit Price', 'Disc', 'Total']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [11, 17, 33], textColor: [255, 255, 255] },
            margin: { left: 15, right: 15 }
        });

        const finalY = doc.lastAutoTable.finalY + 10;

        // Summary
        const summaryX = pageWidth - 70;
        doc.setFont("helvetica", "normal");
        doc.text(`Subtotal:`, summaryX, finalY);
        doc.text(`LKR ${bill.subtotal.toLocaleString()}`, pageWidth - 15, finalY, { align: 'right' });

        doc.text(`Total Discount:`, summaryX, finalY + 5);
        doc.text(`- LKR ${bill.discount.toLocaleString()}`, pageWidth - 15, finalY + 5, { align: 'right' });

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`NET TOTAL:`, summaryX, finalY + 15);
        doc.text(`LKR ${bill.total.toLocaleString()}`, pageWidth - 15, finalY + 15, { align: 'right' });

        if (bill.cashReceived && bill.cashReceived > 0) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Paid Amount:`, summaryX, finalY + 22);
            doc.text(`LKR ${bill.cashReceived.toLocaleString()}`, pageWidth - 15, finalY + 22, { align: 'right' });

            if (bill.changeReturned && bill.changeReturned > 0) {
                doc.text(`Change Returned:`, summaryX, finalY + 27);
                doc.text(`LKR ${bill.changeReturned.toLocaleString()}`, pageWidth - 15, finalY + 27, { align: 'right' });
            }

            const balance = bill.total - bill.cashReceived;
            if (balance > 0) {
                doc.setFont("helvetica", "bold");
                doc.setTextColor(200, 0, 0);
                doc.text(`BALANCE DUE:`, summaryX, finalY + 32);
                doc.text(`LKR ${balance.toLocaleString()}`, pageWidth - 15, finalY + 32, { align: 'right' });
            }
        }

        // Warranty Section
        const warrantyItems = bill.items.filter(i => i.warranty && i.warrantyYears! > 0);
        if (warrantyItems.length > 0) {
            const warrantyY = finalY + 50;
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            doc.text("WARRANTY INFORMATION", 15, warrantyY);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            warrantyItems.forEach((item, idx) => {
                doc.text(`${item.name}: ${item.warrantyYears} ${item.warrantyUnit}`, 15, warrantyY + 7 + (idx * 5));
            });
        }

        // Footer Note
        const footerY = doc.internal.pageSize.height - 30;
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        doc.text(settings.receiptNote || "Thank you for your business!", pageWidth / 2, footerY, { align: 'center' });

        doc.setFont("helvetica", "normal");
        doc.text("Software Powered by WR POS", pageWidth / 2, footerY + 10, { align: 'center' });

        doc.save(`${bill.invoiceNumber}_${new Date().getTime()}.pdf`);
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            errorHandler.log('PDF', err, { operation: 'generateInvoice', invoiceNumber: bill.invoiceNumber }, 'high');
            throw err;
        }
    }
};
