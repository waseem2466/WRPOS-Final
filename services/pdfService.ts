
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Bill, BusinessSettings, Customer } from '../types';
import { errorHandler } from './errorHandler';
import { adminSupabase } from '../src/services/supabase';

const cleanupOldInvoices = async () => {
    try {
        if (!adminSupabase) return;
        const { data: files, error } = await adminSupabase.storage.from('invoices').list();
        if (error || !files) return;

        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const filesToDelete = files
            .filter(f => new Date(f.created_at) < fourteenDaysAgo)
            .map(f => f.name);

        if (filesToDelete.length > 0) {
            await adminSupabase.storage.from('invoices').remove(filesToDelete);
            console.log(`[Supabase] Cleaned up ${filesToDelete.length} old invoices.`);
        }
    } catch (e) {
        console.warn('Failed to cleanup old invoices:', e);
    }
};

const uploadInvoiceToSupabase = async (pdfBlob: Blob, invoiceNumber: string): Promise<string> => {
    cleanupOldInvoices(); // Fire and forget in background
    try {
        if (!adminSupabase) {
            throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        }

        const safeInvoiceNumber = String(invoiceNumber || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${safeInvoiceNumber}_${Date.now()}.pdf`;
        const { error, data } = await adminSupabase.storage
            .from('invoices')
            .upload(fileName, pdfBlob, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (error) throw error;

        const signedUrlResult = await adminSupabase.storage
            .from('invoices')
            .createSignedUrl(data?.path || fileName, 60 * 60 * 24 * 90);

        if (signedUrlResult.data?.signedUrl) {
            return signedUrlResult.data.signedUrl;
        }

        const { data: { publicUrl } } = adminSupabase.storage
            .from('invoices')
            .getPublicUrl(data?.path || fileName);

        try {
            const response = await fetch(publicUrl, { method: 'HEAD' });
            if (!response.ok) {
                throw new Error(`Public invoice URL returned ${response.status}`);
            }
        } catch (urlError) {
            throw new Error('Invoice uploaded, but the PDF URL is not accessible. Make the Supabase "invoices" bucket public or allow signed URL SELECT access.');
        }

        return publicUrl;
    } catch (error) {
        console.error('Error uploading invoice:', error);
        throw error;
    }
};


const getLogoData = async (): Promise<string | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 500;
            const scale = Math.min(MAX_WIDTH / img.width, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/png'));
            } else {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = 'logo.png';
    });
};

export const pdfService = {
    generateInvoice: async (
        bill: Bill,
        settings: BusinessSettings,
        customer?: Customer,
        options?: { download?: boolean }
    ): Promise<string> => {
        try {
        const doc = new jsPDF() as any;

        const pageWidth = doc.internal.pageSize.width;

        // Header
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text(settings.businessName.toUpperCase(), pageWidth / 2, 20 + yOffset, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(settings.address, pageWidth / 2, 28 + yOffset, { align: 'center' });
        doc.text(`Contact: ${settings.contactPhone}`, pageWidth / 2, 33 + yOffset, { align: 'center' });

        doc.setDrawColor(200, 200, 200);
        doc.line(15, 40 + yOffset, pageWidth - 15, 40 + yOffset);

        // Invoice Info
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("INVOICE", 15, 50 + yOffset);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Number: #${bill.invoiceNumber}`, 15, 58 + yOffset);
        doc.text(`Date: ${new Date(bill.date).toLocaleDateString()}`, 15, 63 + yOffset);
        doc.text(`Payment: ${bill.paymentType}`, 15, 68 + yOffset);

        // Customer Info
        if (customer) {
            doc.setFont("helvetica", "bold");
            doc.text("BILL TO:", pageWidth - 70, 50 + yOffset);
            doc.setFont("helvetica", "normal");
            doc.text(customer.name, pageWidth - 70, 58 + yOffset);
            doc.text(customer.phone, pageWidth - 70, 63 + yOffset);
            if (customer.address) {
                doc.text(customer.address, pageWidth - 70, 68 + yOffset, { maxWidth: 55 });
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
            startY: 80 + yOffset,
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

        const pdfBlob = doc.output('blob');
        const downloadName = `${bill.invoiceNumber}_${new Date().getTime()}.pdf`;
        if (options?.download !== false) {
            doc.save(downloadName);
        }

        return await uploadInvoiceToSupabase(pdfBlob, bill.invoiceNumber);
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            errorHandler.log('PDF', err, { operation: 'generateInvoice', invoiceNumber: bill.invoiceNumber }, 'high');
            throw err;
        }
    }
};
