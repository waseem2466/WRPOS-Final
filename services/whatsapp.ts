import { Bill, BusinessSettings, Customer } from '../types';
import { cleanPhone } from './utils';
import { errorHandler } from './errorHandler';

const GROUP_LINK = "https://chat.whatsapp.com/K7ALigMk9ad4SBlcRUqoxX?mode=wwt";

export const whatsappService = {
    generateReceiptMessage: (bill: Bill, settings: BusinessSettings, invoiceUrl?: string): string => {
        const businessName = settings.businessName || 'WR Smile & Supplies';
        const supportPhone = settings.contactPhone || '0719336848';
        const visibleItems = bill.items.slice(0, 8);
        const hiddenItemCount = Math.max(0, bill.items.length - visibleItems.length);

        const itemsText = visibleItems.map(i => {
            const lineGross = i.price * i.quantity;
            const discountValue = i.discountValue || 0;
            const lineDiscount = i.discountType === 'PERCENTAGE'
                ? lineGross * (discountValue / 100)
                : discountValue;
            const lineTotal = Math.max(0, lineGross - lineDiscount);

            let text = `- ${i.name} (${i.quantity} x LKR ${i.price.toLocaleString()})`;
            if (lineDiscount > 0) {
                text += ` | Disc: -LKR ${lineDiscount.toLocaleString()}`;
            }
            text += ` | Sub: LKR ${lineTotal.toLocaleString()}`;
            return text;
        }).join('\n');

        const paid = bill.cashReceived || 0;
        const balanceDue = Math.max(0, bill.total - paid);
        const paymentLabel = balanceDue > 0.1 && paid > 0 ? 'Advance Paid' : 'Paid';
        const balanceLabel = paid > 0 ? 'Remaining Balance' : 'Balance Due';

        const bankDetails = `\n*Settlement Account*\n` +
            `Bank: BOC (Bank of Ceylon)\n` +
            `A/C: 95733864\n` +
            `Name: N K W Khan\n` +
            `Branch: Main Branch`;

        return `*${businessName}*\n` +
            `Invoice: #${bill.invoiceNumber}\n` +
            `Date: ${new Date(bill.date).toLocaleDateString()}\n` +
            `Client: ${bill.customerName}\n\n` +
            `*Items*\n${itemsText || '- No items'}\n` +
            (hiddenItemCount > 0 ? `+ ${hiddenItemCount} more item(s)\n` : '') +
            `\n*Final Total: LKR ${bill.total.toLocaleString()}*\n` +
            `${paymentLabel}: LKR ${paid.toLocaleString()}\n` +
            (balanceDue > 0.1 ? `*${balanceLabel.toUpperCase()}: LKR ${balanceDue.toLocaleString()}*\n` : `*FULLY PAID*\n`) +
            (balanceDue > 0.1 ? bankDetails : '') +
            (invoiceUrl ? `\nInvoice PDF: ${invoiceUrl}` : '') +
            `\n\n${settings.receiptNote || 'Thank you for shopping with us.'}` +
            `\nHotline: ${supportPhone}` +
            (balanceDue > 0.1 ? `\nSupport: ${GROUP_LINK}` : '');
    },

    getTemplateByLanguage: (lang: string) => {
        if (lang === 'ta') return 'bill_total_ta';
        if (lang === 'si') return 'bill_total_si';
        return 'bill_total_notification';
    },

    sendBillTemplate: async (
        settings: BusinessSettings,
        customer: Customer,
        bill: Bill,
        options?: { invoiceUrl?: string }
    ): Promise<void> => {
        const customerPhone = customer.phone;
        if (!customerPhone) return;

        try {
            const message = whatsappService.generateReceiptMessage(bill, settings, options?.invoiceUrl);
            const result = await whatsappService.sendDirect(settings, customerPhone, message, options);
            if (!result.success) throw new Error(result.error);
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            errorHandler.log('WhatsApp', err, { operation: 'sendBillTemplate', type: 'qr-only' }, 'high');
            throw err;
        }
    },

    sendDirect: async (
        settings: BusinessSettings,
        phone: string,
        message: string,
        options?: { invoiceUrl?: string }
    ): Promise<{ success: boolean, error?: string }> => {
        const cleanedPhone = cleanPhone(phone);
        if (!cleanedPhone) return { success: false, error: "Invalid phone number" };

        const cloudToken = settings?.waAccessToken?.trim();
        const cloudPhoneNumberId = settings?.waPhoneNumberId?.trim();
        let cloudError = '';

        if (cloudToken && cloudPhoneNumberId) {
            try {
                const response = await (window as any).electronAPI?.waCloudSend?.({
                    to: cleanedPhone,
                    message,
                    documentUrl: options?.invoiceUrl,
                    documentName: options?.invoiceUrl ? `${Date.now()}_invoice.pdf` : undefined,
                    token: cloudToken,
                    phoneNumberId: cloudPhoneNumberId
                });
                if (response?.success) return { success: true };
                cloudError = response?.error || 'Cloud sending failed';
            } catch (e: unknown) {
                const err = e instanceof Error ? e : new Error(String(e));
                cloudError = err.message || 'Cloud sending failed';
                errorHandler.log('WhatsApp', err, { operation: 'sendDirect', type: 'cloud' }, 'medium');
            }
        }

        try {
            const response = await (window as any).electronAPI?.waQrSend?.({ to: cleanedPhone, message });
            if (!response?.success) {
                const errorText = response?.error || 'QR sending failed';
                throw new Error(errorText);
            }
            return { success: true };
        } catch (qrError: unknown) {
            const err = qrError instanceof Error ? qrError : new Error(String(qrError));
            errorHandler.log('WhatsApp', err, { operation: 'sendDirect', type: 'qr-only' }, 'medium');
            return {
                success: false,
                error: cloudError ? `Cloud failed: ${cloudError}. QR failed: ${err.message}` : (err.message || "QR sending failed")
            };
        }
    },

    verifyConnection: async (settings: BusinessSettings): Promise<boolean> => {
        if (!settings.waAccessToken || !settings.waPhoneNumberId) return false;
        try {
            await (window as any).electronAPI?.waCloudSend?.({
                to: cleanPhone("0719336848"),
                message: `Connection verified for ${settings.businessName}`
            });
            return true;
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            errorHandler.log('WhatsApp', err, { operation: 'verifyConnection' }, 'low');
            return false;
        }

    }
};
