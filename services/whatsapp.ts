import { Bill, BusinessSettings, Customer } from '../types';
import { cleanPhone } from './utils';
import { errorHandler } from './errorHandler';


const SHOP_LOGO = "https://res.cloudinary.com/wrsmile/image/upload/v1765617036/wr_smile_supplies_products/yses6ycpqormspldap12.jpg";
const GROUP_LINK = "https://chat.whatsapp.com/K7ALigMk9ad4SBlcRUqoxX?mode=wwt";

export const whatsappService = {
    generateReceiptMessage: (bill: Bill, settings: BusinessSettings): string => {
        const businessName = settings.businessName || 'WR Smile & Supplies';
        const businessAddress = settings.address || '411/7, Kandy Road, Mollipothana';

        const welcomeMsg = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
            `       *${businessName.toUpperCase()}* 💎\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
            `*Welcome to Smile & Supplies!* 🛒\n` +
            `We offer a variety of online products, including kitchen accessories, home essentials, kids' items, and stationery.\n\n` +
            `📍 ${businessAddress}\n` +
            `📧 Email: smileandsupplies@outlook.com\n` +
            `📞 Hotline: 0719336848\n\n` +
            `"Explore, shop, and enjoy quality products at affordable prices. Feel free to reach out for inquiries or orders!"\n\n` +
            `🔗 *Join Our WhatsApp Group:* \n${GROUP_LINK}\n`;

        const itemsText = bill.items.map(i => {
            const lineTotal = (i.price - (i.discountValue || 0)) * i.quantity;
            let text = `📦 *${i.name.toUpperCase()}*\n   ${i.quantity} x LKR ${i.price.toLocaleString()}`;
            if (i.discountValue && i.discountValue > 0) text += `\n   Disc: -LKR ${(i.discountValue * i.quantity).toLocaleString()}`;
            text += `\n   *Sub: LKR ${lineTotal.toLocaleString()}*`;
            return text;
        }).join('\n\n');

        const paid = bill.cashReceived || 0;
        const balanceDue = Math.max(0, bill.total - paid);

        const bankDetails = `\n─────────────────────\n` +
            `🏦 *SETTLEMENT ACCOUNT (LOAN ONLY)*\n` +
            `*Bank:* BOC (Bank of Ceylon)\n` +
            `*A/C:* 95733864\n` +
            `*Name:* N K W Khan\n` +
            `*Branch:* Main Branch\n` +
            `─────────────────────`;

        return `${welcomeMsg}\n` +
            `🧾 *INVOICE: #${bill.invoiceNumber}*\n` +
            `📅 Date: ${new Date(bill.date).toLocaleDateString()}\n` +
            `👤 Client: ${bill.customerName}\n\n` +
            `*ORDER SUMMARY:*\n${itemsText}\n\n` +
            `📊 *FINAL TOTAL: LKR ${bill.total.toLocaleString()}*\n` +
            `💰 Paid: LKR ${paid.toLocaleString()}\n` +
            (balanceDue > 0.1 ? `⚠️ *BALANCE DUE: LKR ${balanceDue.toLocaleString()}*\n` : `✅ *FULLY PAID*\n`) +
            (balanceDue > 0.1 ? bankDetails : '') +
            `\n\n*${settings.receiptNote || 'Premium Quality. Professional Service.'}* 🤝\n` +
            `Powered by ${businessName} 🤖`;
    },

    getTemplateByLanguage: (lang: string) => {
        if (lang === 'ta') return 'bill_total_ta';
        if (lang === 'si') return 'bill_total_si';
        return 'bill_total_notification';
    },

    sendBillTemplate: async (settings: BusinessSettings, customer: Customer, bill: Bill): Promise<void> => {
        const customerPhone = customer.phone;
        if (!customerPhone) return;

        const hasCloud = settings.waAccessToken && settings.waPhoneNumberId;

        if (hasCloud) {
            const template = whatsappService.getTemplateByLanguage(customer.language || 'en');

            const params = [
                customer.name || 'Customer',
                'WR SMILE SUPPLIES',
                bill.invoiceNumber,
                bill.total.toString()
            ];

            try {
                await (window as any).electronAPI?.waCloudSendTemplate?.({
                    to: customerPhone,
                    template,
                    language: customer.language === 'ta' ? 'ta' : (customer.language === 'si' ? 'si' : 'en_US'),
                    params
                });

                const fullMessage = whatsappService.generateReceiptMessage(bill, settings);
                await whatsappService.sendDirect(settings, customerPhone, fullMessage);
                return;

            } catch (error: unknown) {
                const err = error instanceof Error ? error : new Error(String(error));
                errorHandler.log('WhatsApp', err, { operation: 'sendBillTemplate', type: 'cloud' }, 'medium');
            }

        }

        try {
            const message = whatsappService.generateReceiptMessage(bill, settings);
            await whatsappService.sendDirect(settings, customerPhone, message);
        } catch (e: unknown) {

            const err = e instanceof Error ? e : new Error(String(e));
            errorHandler.log('WhatsApp', err, { operation: 'sendBillTemplate', type: 'fallback' }, 'high');
        }

    },

    sendDirect: async (settings: BusinessSettings, phone: string, message: string): Promise<void> => {

        const cleanedPhone = cleanPhone(phone);
        if (!cleanedPhone) return;

        if (settings.waAccessToken && settings.waPhoneNumberId) {
            try {
                await (window as any).electronAPI?.waCloudSend?.({ to: cleanedPhone, message: message });
                return;
            } catch (error: unknown) {
                const err = error instanceof Error ? error : new Error(String(error));
                errorHandler.log('WhatsApp', err, { operation: 'sendDirect', type: 'cloud' }, 'medium');
            }

        }

        try {
            await (window as any).electronAPI?.waQrSend?.({ to: cleanedPhone, message: message });
        } catch (qrError: unknown) {
            const err = qrError instanceof Error ? qrError : new Error(String(qrError));
            errorHandler.log('WhatsApp', err, { operation: 'sendDirect', type: 'qr' }, 'medium');
        }

    },

    verifyConnection: async (settings: BusinessSettings): Promise<boolean> => {
        if (!settings.waAccessToken || !settings.waPhoneNumberId) return false;
        try {
            await (window as any).electronAPI?.waCloudSend?.({
                to: "94719336848",
                message: `✅ ${settings.businessName}: Connection Verified!`
            });
            return true;
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            errorHandler.log('WhatsApp', err, { operation: 'verifyConnection' }, 'low');
            return false;
        }

    }
};
