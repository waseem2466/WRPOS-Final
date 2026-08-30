import { Bill, BusinessSettings, Customer, Supplier, SupplierPayment, PurchaseOrder } from '../types';
import { cleanPhone } from './utils';
import { errorHandler } from './errorHandler';

const GROUP_LINK = "https://chat.whatsapp.com/G2sFie5DaUHL4XyY2oGEbP";

export const whatsappService = {
    getSupplierPrimaryPhone: (supplier: Supplier): string => {
        return supplier.phone || supplier.hotline || supplier.workerMobile || '';
    },

    generateSupplierPurchaseOrderMessage: (supplier: Supplier, po: PurchaseOrder, settings?: BusinessSettings | null): string => {
        const businessName = settings?.businessName || 'WR POS';
        
        let itemsSubtotal = 0;
        const itemsText = (po.items || []).map(i => {
            const unitCost = i.unitCost || 0;
            const discountPct = i.discountPercentage || 0;
            const discountedUnitCost = unitCost * (1 - discountPct / 100);
            const lineTotal = discountedUnitCost * (i.quantity || 1);
            itemsSubtotal += lineTotal;

            let itemStr = `- ${i.name} (Qty: ${i.quantity} x LKR ${unitCost.toLocaleString()}`;
            if (discountPct > 0) {
                itemStr += ` | Disc: ${discountPct}%`;
            }
            itemStr += `) = LKR ${lineTotal.toLocaleString()}`;
            return itemStr;
        }).join('\n');

        const poCashDiscount = po.discountAmount || 0;
        const transportCost = po.transportPaidExternal ? 0 : (po.transportCost || 0);
        const finalNetTotal = Math.max(0, itemsSubtotal - poCashDiscount + transportCost);
        const paidAmount = po.paidAmount || 0;
        const balanceDue = Math.max(0, finalNetTotal - paidAmount);

        let breakdownText = `Subtotal: LKR ${itemsSubtotal.toLocaleString()}\n`;
        if (poCashDiscount > 0) {
            breakdownText += `PO Cash Discount: -LKR ${poCashDiscount.toLocaleString()}\n`;
        }
        if (po.transportCost && po.transportCost > 0) {
            breakdownText += `Transport Cost (${po.transportPaidExternal ? 'External' : 'Included'}): +LKR ${po.transportCost.toLocaleString()}\n`;
        }

        return `*PURCHASE ORDER: #${po.id.slice(-6)}*\n` +
            `*${businessName}*\n\n` +
            `Supplier: ${supplier.name}\n` +
            `Date: ${new Date(po.date).toLocaleDateString()}\n\n` +
            `*ORDER MANIFEST:*\n${itemsText || '- No items'}\n\n` +
            `==========================\n` +
            breakdownText +
            `*Final Bill Total: LKR ${finalNetTotal.toLocaleString()}*\n` +
            `Paid Amount: LKR ${paidAmount.toLocaleString()}\n` +
            (balanceDue > 0 ? `*Balance Due: LKR ${balanceDue.toLocaleString()}*\n` : `*FULLY SETTLED*\n`) +
            `==========================\n` +
            `Status: ${po.status}\n\n` +
            `_Please confirm dispatch and expected delivery._`;
    },

    generateSupplierPaymentVoucherMessage: (
        supplier: Supplier,
        payment: SupplierPayment,
        po?: PurchaseOrder | null,
        totalSupplierBalance?: number,
        settings?: BusinessSettings | null
    ): string => {
        const businessName = settings?.businessName || 'WR POS';
        const methodLabel = payment.paymentMethod === 'CHEQUE' 
            ? `Cheque (No: ${payment.chequeNumber || 'N/A'}, Date: ${payment.chequeDate || 'N/A'})`
            : payment.paymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Cash';

        let poDetails = '';
        if (po) {
            poDetails = `\n*Linked PO:* #${po.id.slice(-6)}\n`;
            if (po.items && po.items.length > 0) {
                const itemsList = po.items.map(i => `- ${i.name} (Qty: ${i.quantity})`).join('\n');
                poDetails += `*PO Items:*\n${itemsList}\n`;
            }
        }

        const dateStr = payment.date ? new Date(payment.date).toLocaleDateString() : new Date().toLocaleDateString();

        return `*SUPPLIER PAYMENT VOUCHER: #${payment.id.slice(-6)}*\n` +
            `*${businessName}*\n\n` +
            `Supplier: ${supplier.name}\n` +
            `Date: ${dateStr}\n` +
            `Payment Method: ${methodLabel}\n` +
            (payment.note ? `Note: ${payment.note}\n` : '') +
            poDetails +
            `\n*Amount Paid: LKR ${payment.amount.toLocaleString()}*\n` +
            (typeof totalSupplierBalance === 'number' ? `*Remaining Balance Due: LKR ${totalSupplierBalance.toLocaleString()}*\n` : '') +
            `\n_Thank you for your business & partnership!_`;
    },

    generateSupplierStatementMessage: (
        supplier: Supplier,
        stats: { totalBilled: number; totalPaid: number; balance: number },
        pendingOrdersCount: number,
        settings?: BusinessSettings | null
    ): string => {
        const businessName = settings?.businessName || 'WR POS';
        const primaryPhone = supplier.phone || supplier.hotline || supplier.workerMobile || 'N/A';

        return `*SUPPLIER ACCOUNT STATEMENT*\n` +
            `*${businessName}*\n\n` +
            `Supplier: ${supplier.name}\n` +
            `Primary Mobile: ${primaryPhone}\n` +
            `Date: ${new Date().toLocaleDateString()}\n\n` +
            `==========================\n` +
            `*FINANCIAL SUMMARY*\n` +
            `- Total Procurement Billed: LKR ${stats.totalBilled.toLocaleString()}\n` +
            `- Total Settlements Paid: LKR ${stats.totalPaid.toLocaleString()}\n` +
            `- Pending Active Orders: ${pendingOrdersCount}\n` +
            `==========================\n\n` +
            (stats.balance > 0 
                ? `*OUTSTANDING BALANCE DUE: LKR ${stats.balance.toLocaleString()}*\n\n_Please review the ledger summary above._`
                : `*ACCOUNT STATUS: FULLY SETTLED (NO BALANCE DUE)*\n`) +
            `\n_Thank you for your ongoing partnership!_`;
    },
    generateReceiptMessage: (bill: Bill, settings: BusinessSettings, invoiceUrl?: string): string => {
        const businessName = settings.businessName || 'WR Smile & Supplies';
        const supportPhone = settings.contactPhone || '0719336848';
        const visibleItems = bill.items; // Full items, no slicing
        const hiddenItemCount = 0;

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

        return `*Welcome to Smile & Supplies!* 🛒\n` +
            `We offer a variety of online products, including kitchen accessories, home essentials, kids' items, and stationery.\n\n` +
            `📞 Contact: 0719336848\n` +
            `📧 Email: smileandsupplies@outlook.com\n\n` +
            `==========================\n` +
            `*INVOICE: #${bill.invoiceNumber}*\n` +
            `Date: ${new Date(bill.date).toLocaleDateString()}\n` +
            `Client: ${bill.customerName}\n\n` +
            `*Items*\n${itemsText || '- No items'}\n` +
            (bill.discount && bill.discount > 0 ? `Subtotal: LKR ${(bill.subtotal || bill.total + bill.discount).toLocaleString()}\nBill Cash Discount: -LKR ${bill.discount.toLocaleString()}\n` : '') +
            `*Final Total: LKR ${bill.total.toLocaleString()}*\n` +
            `${paymentLabel}: LKR ${paid.toLocaleString()}\n` +
            (balanceDue > 0.1 ? `*${balanceLabel.toUpperCase()}: LKR ${balanceDue.toLocaleString()}*\n` : `*FULLY PAID*\n`) +
            (balanceDue > 0.1 ? bankDetails : '') +
            (invoiceUrl ? `\n📄 Invoice PDF: ${invoiceUrl}` : '') +
            `\n==========================\n\n` +
            `"Explore, shop, and enjoy quality products at affordable prices. Feel free to reach out for inquiries or orders!"\n` +
            `Follow this link to join my WhatsApp group: https://chat.whatsapp.com/G2sFie5DaUHL4XyY2oGEbP\n\n` +
            `*No Cash on delivery*\n` +
            `*Cash deposit only*`;
    },

    generateReloadReceiptMessage: (
        mobile: string,
        amount: number,
        provider: string,
        orderId: string,
        status: string,
        settings?: BusinessSettings | null
    ): string => {
        const businessName = settings?.businessName || 'WR POS';
        const formattedAmount = amount.toLocaleString('en-LK', { minimumFractionDigits: 2 });
        return `⚡ *MOBILE RELOAD RECEIPT*\n` +
            `*${businessName}*\n\n` +
            `📱 *Mobile No:* ${mobile}\n` +
            `📶 *Provider:* ${provider}\n` +
            `💵 *Amount Paid:* LKR ${formattedAmount}\n` +
            `🆔 *Order ID:* ${orderId}\n` +
            `Status: ${status === 'SUCCESS' ? '✅ SUCCESSFUL' : '🔄 ' + status}\n` +
            `📅 *Date:* ${new Date().toLocaleString()}\n\n` +
            `==========================\n` +
            `Thank you for using our reload service!\n\n` +
            `Follow this link to join our WhatsApp group:\n${GROUP_LINK}`;
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
    ): Promise<{ success: boolean, error?: string, rawMessage?: string }> => {
        const cleanedPhone = cleanPhone(phone);
        if (!cleanedPhone) return { success: false, error: "Invalid phone number" };

        let relayError = '';

        // 1. Try Koyeb Relay FIRST (Primary active WhatsApp server)
        try {
            const response = await (window as any).electronAPI?.waRelaySend?.({
                to: cleanedPhone,
                message,
                documentUrl: options?.invoiceUrl,
                documentName: options?.invoiceUrl ? `${Date.now()}_invoice.pdf` : undefined
            });
            if (response?.success) return { success: true };
            if (response?.error) {
                relayError = response.error;
            }
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            relayError = err.message || 'Koyeb Relay sending failed';
            errorHandler.log('WhatsApp', err, { operation: 'sendDirect', type: 'relay' }, 'medium');
        }

        // 2. Try Local Baileys QR Bot
        try {
            const response = await (window as any).electronAPI?.waQrSend?.({ 
                to: cleanedPhone, 
                message,
                documentUrl: options?.invoiceUrl,
                documentName: options?.invoiceUrl ? `${Date.now()}_invoice.pdf` : undefined
            });
            if (response) return { success: true };
        } catch (qrError: unknown) {
            const err = qrError instanceof Error ? qrError : new Error(String(qrError));
            errorHandler.log('WhatsApp', err, { operation: 'sendDirect', type: 'qr-only' }, 'medium');
        }

        // 3. Try Meta Cloud API (tertiary fallback)
        const cloudToken = settings?.waAccessToken?.trim();
        const cloudPhoneNumberId = settings?.waPhoneNumberId?.trim();
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
            } catch (e: unknown) {
                const err = e instanceof Error ? e : new Error(String(e));
                errorHandler.log('WhatsApp', err, { operation: 'sendDirect', type: 'cloud' }, 'medium');
            }
        }

        // If all dispatch channels failed
        const diagnosticError = relayError || 'WhatsApp Koyeb Relay server is not responding. Please check your internet connection.';

        return {
            success: false,
            error: diagnosticError,
            rawMessage: message
        };
    },

    openDirectWhatsApp: (phone: string, message: string) => {
        const cleaned = cleanPhone(phone);
        const url = `https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
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
