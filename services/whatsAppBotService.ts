import { whatsappService } from './whatsapp';
import { db } from './mockDb';
import { errorHandler } from './errorHandler';
import type { Customer, Bill, BusinessSettings } from '../types';

/**
 * WhatsApp Bot Service
 * Handles incoming WhatsApp messages and responds appropriately
 */
export const whatsAppBotService = {
  /**
   * Process incoming WhatsApp message
   */
  processIncomingMessage: async (
    from: string,
    text: string,
    settings: BusinessSettings
  ): Promise<string | null> => {
    try {
      errorHandler.log('WhatsAppBotService', new Error(`Processing message from ${from}: ${text}`), { 
        operation: 'processIncomingMessage',
        from,
        method: 'receive'
      }, 'low');

      const customers = await db.customers.getAll();
      const customer = customers.find((c: Customer) => c.phone === from);

      if (!customer) {
        return "Hello! You're not registered in our system. Please visit our store to register.";
      }

      const lowerText = text.toLowerCase().trim();

      // Handle different message types
      if (lowerText.includes('balance') || lowerText.includes('loan')) {
        return `Hello ${customer.name}! Your current balance is LKR ${customer.balanceDue.toLocaleString()}. Total loan: LKR ${customer.totalLoan.toLocaleString()}.`;
      }

      if (lowerText.includes('bill') || lowerText.includes('invoice')) {
        const bills = await db.bills.getAllForCustomer(customer.id);
        if (bills.length === 0) {
          return `Hello ${customer.name}! You have no bills in our system.`;
        }
        const latestBill = bills[0];
        return `Hello ${customer.name}! Your latest bill #${latestBill.invoiceNumber} is LKR ${latestBill.total.toLocaleString()}. Status: ${latestBill.paymentType}.`;
      }

      if (lowerText.includes('payment') || lowerText.includes('pay')) {
        return `Hello ${customer.name}! To make a payment, please visit our store or use our online payment portal. Your current balance is LKR ${customer.balanceDue.toLocaleString()}.`;
      }

      // Default response
      return `Hello ${customer.name}! Welcome to ${settings.businessName}. How can I help you today? You can ask about: balance, bills, or payments.`;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      errorHandler.log('WhatsAppBotService', err, { 
        operation: 'processIncomingMessage',
        from,
        method: 'receive'
      }, 'high');
      return "Sorry, I couldn't process your request. Please try again later.";
    }
  },

  /**
   * Send bill notification to customer
   */
  sendBillNotification: async (
    customer: Customer,
    bill: Bill,
    settings: BusinessSettings
  ): Promise<boolean> => {
    try {
      if (!customer.phone) {
        errorHandler.log('WhatsAppBotService', new Error('Customer has no phone number'), { 
          operation: 'sendBillNotification',
          customerId: customer.id
        }, 'medium');
        return false;
      }

      const message = whatsappService.generateReceiptMessage(bill, settings);
      await whatsappService.sendDirect(settings, customer.phone, message);
      
      errorHandler.log('WhatsAppBotService', new Error(`Bill notification sent to ${customer.name}`), { 
        operation: 'sendBillNotification',
        customerId: customer.id,
        billId: bill.id
      }, 'low');
      
      return true;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      errorHandler.log('WhatsAppBotService', err, { 
        operation: 'sendBillNotification',
        customerId: customer.id,
        billId: bill.id
      }, 'high');
      return false;
    }
  },

  /**
   * Send payment reminder to customer
   */
  sendPaymentReminder: async (
    customer: Customer,
    settings: BusinessSettings
  ): Promise<boolean> => {
    try {
      if (!customer.phone) {
        errorHandler.log('WhatsAppBotService', new Error('Customer has no phone number'), { 
          operation: 'sendPaymentReminder',
          customerId: customer.id
        }, 'medium');
        return false;
      }

      if (customer.balanceDue <= 0) {
        return false; // No balance due
      }

      const message = `*Payment Reminder* 🔔\n\n` +
        `Hello ${customer.name},\n\n` +
        `This is a friendly reminder that you have an outstanding balance of *LKR ${customer.balanceDue.toLocaleString()}*.\n\n` +
        `Please make a payment at your earliest convenience.\n\n` +
        `Thank you,\n${settings.businessName}`;

      await whatsappService.sendDirect(settings, customer.phone, message);
      
      errorHandler.log('WhatsAppBotService', new Error(`Payment reminder sent to ${customer.name}`), { 
        operation: 'sendPaymentReminder',
        customerId: customer.id
      }, 'low');
      
      return true;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      errorHandler.log('WhatsAppBotService', err, { 
        operation: 'sendPaymentReminder',
        customerId: customer.id
      }, 'high');
      return false;
    }
  }
};
