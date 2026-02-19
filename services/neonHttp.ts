import { errorHandler } from './errorHandler';

const NEON_API_URL = import.meta.env.VITE_NEON_API_URL;
const DATABASE_URL = import.meta.env.DATABASE_URL;

export const neonHttp = {
    /**
     * Execute a SQL query via the Neon REST API
     * This is useful for environments where standard PG connections are blocked
     */
    query: async (sql: string, params: any[] = []) => {
        try {
            if (!NEON_API_URL) {
                throw new Error('Neon API URL not configured');
            }

            const response = await fetch(NEON_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DATABASE_URL}` // Neon REST often uses the full URL as an auth key or separate token
                },
                body: JSON.stringify({
                    sql,
                    params,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Neon API Error: ${response.statusText}`);
            }

            return result;
        } catch (err: any) {
            errorHandler.log('NeonHTTP', err, { operation: 'query', sql }, 'medium');
            return { success: false, error: err.message };
        }
    },

    /**
     * Helper to format sync operations as SQL and execute via REST
     */
    syncAction: async (action: string, payload: any) => {
        try {
            console.log(`[NeonHTTP] Syncing ${action}...`);
            let sql = '';
            let params: any[] = [];

            switch (action) {
                case 'ADD_BILL':
                    const { bill } = payload;
                    sql = `INSERT INTO "Bill" (id, invoice_number, date, total, customer_id, customer_name, subtotal, discount, payment_type) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`;
                    params = [bill.id, bill.invoiceNumber, bill.date, bill.total, bill.customerId, bill.customerName, bill.subtotal, bill.discount, bill.paymentType];
                    // Note: Bill items and stock updates would require a more complex multi-statement or separate calls
                    break;
                case 'ADD_CUSTOMER':
                case 'ADD_CUSTOMER_FULL':
                    sql = `INSERT INTO "Customer" (id, name, phone, nic, address, language) 
                           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name=$2, phone=$3, address=$5`;
                    params = [payload.id, payload.name, payload.phone, payload.nic, payload.address, payload.language || 'en'];
                    break;
                case 'ADD_PRODUCT':
                    sql = `INSERT INTO "Product" (id, name, barcode, sku, cost, price, stock, category) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET name=$2, price=$6, stock=$7`;
                    params = [payload.id, payload.name, payload.barcode, payload.sku, payload.cost, payload.price, payload.stock, payload.category];
                    break;
                case 'ADD_EXPENSE':
                    sql = `INSERT INTO "Expense" (id, category, amount, date, note) 
                           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`;
                    params = [payload.id, payload.category, payload.amount, payload.date, payload.note];
                    break;
                case 'ADD_PAYMENT':
                    sql = `INSERT INTO "Payment" (id, customer_id, amount, date, note) 
                           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`;
                    params = [payload.id, payload.customerId, payload.amount, payload.date, payload.note];
                    break;
                default:
                    console.warn(`[NeonHTTP] Unhandled sync action: ${action}`);
                    return;
            }

            if (sql) {
                await neonHttp.query(sql, params);
            }
        } catch (err: any) {
            console.error(`[NeonHTTP] Sync failed for ${action}:`, err.message);
        }
    }

};
