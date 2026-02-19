import { whatsappService } from "./whatsapp";
import { errorHandler } from './errorHandler';
import type { Bill, Customer, BusinessSettings } from '../types';


/**
 * Enterprise Receipt Generator
 * Produces a high-quality, professional text receipt for WR POS.
 */
export const buildInvoiceMessage = (bill: Bill, settings: BusinessSettings) => {

    // We leverage the existing enterprise-grade generator in whatsappService
    // but keep the function name for architectural alignment with user preference.
    return whatsappService.generateReceiptMessage(bill, settings);
};

/**
 * Auto-Send WhatsApp Bill
 * Dispatches the invoice via the preferred method (Cloud or QR).
 */
export const autoSendWhatsAppBill = async (
    bill: Bill,
    customer: Customer,
    settings: BusinessSettings
) => {

    if (!customer?.phone) return;

    try {
        // We use the existing robust dispatch logic which handles templates,
        // languages, and failover between Cloud and QR automatically.
        await whatsappService.sendBillTemplate(settings, customer, bill);
        errorHandler.log('WhatsAppAutoSend', new Error(`Invoice ${bill.invoiceNumber} sent to ${customer.name}`), { 
            operation: 'autoSendWhatsAppBill', 
            invoiceNumber: bill?.invoiceNumber,
            customerName: customer?.name 
        }, 'low');
    } catch (error: unknown) {

        const err = error instanceof Error ? error : new Error(String(error));
        errorHandler.log('WhatsAppAutoSend', err, { 
            operation: 'autoSendWhatsAppBill', 
            invoiceNumber: bill?.invoiceNumber,
            customerName: customer?.name 
        }, 'high');
    }
};
