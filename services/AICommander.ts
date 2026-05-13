
import { generateAiContent, getAIEngine } from './ai';
import { errorHandler } from './errorHandler';

export interface SalesData {
    today: number;
    yesterday: number;
    weekToDate: number;
    monthToDate: number;
}

export interface StockItem {
    name: string;
    currentStock: number;
    reorderLevel: number;
}

export interface CustomerInquiry {
    name: string;
    inquiry: string;
    context?: string;
}

export class AICommander {

    /**
     * Generates a concise sales insight report.
     * Compares today vs yesterday, week, month.
     */
    static async getSalesAdvice(sales: SalesData): Promise<string> {
        const prompt = `
Analyze this POS Sales Data:
- Today: ${sales.today}
- Yesterday: ${sales.yesterday}
- Week To Date: ${sales.weekToDate}
- Month To Date: ${sales.monthToDate}

Provide 3 short, actionable bullet points to improve revenue.
Keep it concise (under 50 words).
`.trim();

        return this.safeExecute(prompt, 'Sales Analysis', 120);
    }

    /**
     * Generates prioritized restocking suggestions for low stock items.
     */
    static async getRestockSuggestions(items: StockItem[]): Promise<string> {
        if (!items.length) return "Stock levels are healthy. No immediate restocking needed.";

        const list = items.map(i => `- ${i.name} (Qty: ${i.currentStock}, Reorder at: ${i.reorderLevel})`).join('\n');
        const prompt = `
Inventory Alert! Low Stock Items:
${list}

Suggest which items to order first based on necessity and urgency.
Provide recommended order quantities. Keep it concise and professional.
`.trim();

        return this.safeExecute(prompt, 'Inventory Advisor', 150);
    }

    /**
     * Generates a professional, warm reply for a customer inquiry.
     */
    static async generateCustomerReply(customer: CustomerInquiry): Promise<string> {
        const prompt = `
You are a helpful customer service assistant for a retail store.
Customer: ${customer.name}
Inquiry: "${customer.inquiry}"
Context: ${customer.context || "General Inquiry"}

Draft a warm, short (1-2 sentences) WhatsApp reply. Sign off with 'WR POS Team'.
Do not use placeholders.
`.trim();

        return this.safeExecute(prompt, 'Customer Reply', 80);
    }

    /**
     * Generates business insight summary with sales + inventory combined.
     */
    static async generateBusinessSummary(
        sales: SalesData,
        lowStockItems: StockItem[]
    ): Promise<string> {
        const stockList = lowStockItems.length
            ? lowStockItems.map(i => `- ${i.name} (Qty: ${i.currentStock})`).join('\n')
            : "None";

        const prompt = `
POS Business Summary:

Sales:
- Today: ${sales.today}
- Yesterday: ${sales.yesterday}
- Week: ${sales.weekToDate}
- Month: ${sales.monthToDate}

Low Stock Items:
${stockList}

Provide actionable insights:
1. Restock priorities
2. Revenue improvement tips
3. Operational advice

Keep concise and professional (max 100 words).
`.trim();

        return this.safeExecute(prompt, 'Business Summary', 200);
    }

    /**
     * Parse user input and return structured intent for POS automation.
     * Supported ACTIONS: NAVIGATE, BILLING_ADD, INVENTORY_SEARCH, CUSTOMER_SEARCH, ANALYTICS
     */
    static async parseUserIntent(input: string): Promise<{ type: string; payload: unknown }> {
        const prompt = `
Analyze input and return ONLY JSON. 
ACTIONS: NAVIGATE, BILLING_ADD, INVENTORY_SEARCH, CUSTOMER_SEARCH, ANALYTICS
Input: "${input}"
`;

        try {
            const response = await this.safeExecute(prompt, 'Intent Parsing', 80);

            // Check if response is a failure message
            if (response.startsWith('⚠️')) {
                throw new Error(response);
            }

            // Robust sanitization: remove markdown code blocks and whitespace
            const jsonStr = response.replace(/```(json)?/g, '').trim();
            try {
                return JSON.parse(jsonStr);
            } catch (pErr) {
                console.error('[AICommander] JSON Parse Failed for:', jsonStr);
                throw pErr;
            }
        } catch (err) {
            errorHandler.log('AI', err instanceof Error ? err : new Error(String(err)), { operation: 'Intent Parsing' }, 'medium');
            return { type: 'UNKNOWN', payload: { reason: 'AI Error or Invalid JSON' } };
        }
    }

    /**
     * Safer AI execution wrapper with fallback and logging.
     */
    private static async safeExecute(prompt: string, context: string, maxTokens: number = 150): Promise<string> {
        try {
            const provider = getAIEngine();
            return await generateAiContent(prompt, { provider });
        } catch (error) {
            const e = error instanceof Error ? error : new Error(String(error));
            errorHandler.log('AI', e, { operation: context }, 'medium');
            return `⚠️ AI unavailable for ${context}. Please check connection.`;
        }
    }
}
