import { errorHandler } from './errorHandler';

const NEON_API_URL = import.meta.env.VITE_NEON_API_URL;
const NEON_API_TOKEN = import.meta.env.VITE_NEON_API_TOKEN || import.meta.env.NEON_API_TOKEN;
let hasWarnedAboutTokenType = false;
const hasUsableRestToken = Boolean(NEON_API_TOKEN && !NEON_API_TOKEN.startsWith('napi_'));
const hasRestEndpoint = Boolean(NEON_API_URL);

export const neonHttp = {
    isConfigured: () => hasRestEndpoint,
    isUsable: () => hasRestEndpoint && hasUsableRestToken,
    /**
     * Execute a SQL query via the Neon REST API
     * This is useful for environments where standard PG connections are blocked
     */
    query: async (sql: string, params: any[] = []) => {
        try {
            if (!NEON_API_URL) {
                throw new Error('Neon API URL not configured');
            }

            // --- TOKEN VALIDATION ---
            // If the token starts with 'napi_', it is a Management API key, not a DB Query JWT.
            // Using it for SQL queries via the proxy will result in a 400 'invalid JWT encoding' error.
            if (!hasUsableRestToken) {
                if (!hasWarnedAboutTokenType) {
                    console.warn('[NeonHTTP] REST sync is disabled because the configured Neon token is a management key. Use a Neon SQL/JWT token for REST queries, or rely on the desktop database connection.');
                    hasWarnedAboutTokenType = true;
                }
                return { success: false, error: 'Incompatible token type found' };
            }

            const response = await fetch(NEON_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${NEON_API_TOKEN}`
                },
                body: JSON.stringify({
                    query: sql,
                    params,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('[NeonHTTP] Server Response:', result);
                throw new Error(result.message || result.error || JSON.stringify(result) || `Neon API Error: ${response.statusText}`);
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
            if (!neonHttp.isUsable()) {
                return { success: false, skipped: true, error: 'REST sync unavailable' };
            }
            console.log(`[NeonHTTP] Syncing ${action}...`);
            let sql = '';
            let params: any[] = [];

            switch (action) {
                case 'ADD_BILL':
                    const { bill } = payload;
                    sql = `INSERT INTO "Bill" (id, invoice_number, date, total, customer_id, customer_name, subtotal, discount, payment_type) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`;
                    params = [bill.id, bill.invoiceNumber, bill.date, bill.total, bill.customerId, bill.customerName, bill.subtotal, bill.discount, bill.paymentType];
                    break;
                case 'ADD_CUSTOMER':
                case 'ADD_CUSTOMER_FULL':
                    sql = `INSERT INTO "Customer" (id, name, phone, nic, address, language, total_loan, total_paid, balance) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                           ON CONFLICT (phone) DO UPDATE SET
                             name=COALESCE(NULLIF(EXCLUDED.name, ''), "Customer".name),
                             nic=COALESCE(NULLIF(EXCLUDED.nic, ''), "Customer".nic),
                             address=COALESCE(NULLIF(EXCLUDED.address, ''), "Customer".address),
                             language=COALESCE(EXCLUDED.language, "Customer".language),
                             total_loan=GREATEST("Customer".total_loan, EXCLUDED.total_loan),
                             total_paid=GREATEST("Customer".total_paid, EXCLUDED.total_paid),
                             balance=GREATEST("Customer".balance, EXCLUDED.balance)`;
                    params = [payload.id, payload.name, payload.phone, payload.nic, payload.address, payload.language || 'en', payload.totalLoan || 0, payload.totalPaid || 0, payload.balanceDue || 0];
                    break;
                case 'ADD_PRODUCT':
                    sql = `INSERT INTO "Product" (id, name, barcode, sku, cost, price, stock, category) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET name=$2, price=$6, stock=$7`;
                    params = [payload.id, payload.name, payload.barcode, payload.sku, payload.cost, payload.price, payload.stock, payload.category];
                    break;
                case 'ADD_PRODUCT_REQUEST':
                    sql = `INSERT INTO "ProductRequest" (id, item_name, quantity, customer_id, customer_name, customer_phone, note, status, ordered_purchase_order_id, created_at, updated_at)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamp, NOW()), NOW())
                           ON CONFLICT (id) DO UPDATE SET item_name=$2, quantity=$3, customer_id=$4, customer_name=$5, customer_phone=$6, note=$7, status=$8, ordered_purchase_order_id=$9, updated_at=NOW()`;
                    params = [payload.id, payload.itemName, payload.quantity, payload.customerId || null, payload.customerName || '', payload.customerPhone || '', payload.note || '', payload.status || 'OPEN', payload.orderedPurchaseOrderId || null, payload.createdAt];
                    break;
                case 'ADD_EXPENSE':
                    sql = `INSERT INTO "Expense" (id, category, amount, date, note) 
                           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`;
                    params = [payload.id, payload.category, payload.amount, payload.date, payload.note];
                    break;
                case 'ADD_PAYMENT':
                    sql = `INSERT INTO "Payment" (id, customer_id, amount, date, note) 
                           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET amount=$3, note=$5`;
                    params = [payload.id, payload.customerId, payload.amount, payload.date, payload.note];
                    break;
                case 'UNLINKED_RETURN':
                    const unlinkedRefundVal = payload.unlinkedItemDetails.price * payload.unlinkedQty;
                    const unlinkedRefundCost = payload.unlinkedItemDetails.cost * payload.unlinkedQty;
                    const unlinkedRefundProfit = payload.unlinkedItemDetails.profit * payload.unlinkedQty;
                    sql = `INSERT INTO "ReturnRecord" (id, bill_id, product_id, quantity, refund_value, refund_cost, refund_profit, payment_type, customer_id, date, note) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10) ON CONFLICT (id) DO NOTHING`;
                    params = [payload.returnId, 'UNLINKED', payload.unlinkedItemDetails.productId, payload.unlinkedQty, unlinkedRefundVal, unlinkedRefundCost, unlinkedRefundProfit, payload.unlinkedBillDetails.paymentType || 'CASH', payload.unlinkedBillDetails.customerId, 'Unlinked return to stock'];
                    break;
                case 'RETURN_ITEM':
                    const refundVal = payload.itemDetails.price * payload.qty;
                    const refundCost = payload.itemDetails.cost * payload.qty;
                    const refundProfit = (payload.itemDetails.profit / payload.itemDetails.quantity) * payload.qty;
                    sql = `INSERT INTO "ReturnRecord" (id, bill_id, product_id, quantity, refund_value, refund_cost, refund_profit, payment_type, customer_id, date, note) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10) ON CONFLICT (id) DO NOTHING`;
                    params = [payload.returnId, payload.billId, payload.itemDetails.productId, payload.qty, refundVal, refundCost, refundProfit, payload.billDetails.paymentType || 'CASH', payload.billDetails.customerId, 'Restored to stock'];
                    break;
                case 'UPDATE_PO_STATUS':
                    sql = `UPDATE "PurchaseOrder" SET status=$2, paid_amount=$3, total_cost=$4 WHERE id=$1`;
                    params = [payload.id, payload.status, payload.paidAmount, payload.totalCost];
                    break;
                case 'ADD_PURCHASE_ORDER':
                    sql = `INSERT INTO "PurchaseOrder" (id, supplier_id, supplier_name, items, total_cost, paid_amount, payment_method, status, transport_cost, transport_paid_external, date) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamp, NOW()))
                           ON CONFLICT (id) DO UPDATE SET
                             supplier_id=$2,
                             supplier_name=$3,
                             items=$4,
                             total_cost=$5,
                             paid_amount=$6,
                             payment_method=$7,
                             status=$8,
                             transport_cost=$9,
                             transport_paid_external=$10,
                             date=COALESCE($11::timestamp, "PurchaseOrder".date)`;
                    params = [payload.id, payload.supplierId, payload.supplierName, JSON.stringify(payload.items), payload.totalCost, payload.paidAmount, payload.paymentMethod, payload.status, payload.transportCost, payload.transportPaidExternal, payload.date];
                    break;
                case 'ADD_SUPPLIER':
                    sql = `INSERT INTO "Supplier" (id, name, phone, hotline, worker_mobile, contact_person, category, email, address, bank_name, account_number, branch) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
                           ON CONFLICT (id) DO UPDATE SET name=$2, phone=$3, email=$8, category=$7`;
                    params = [payload.id, payload.name, payload.phone, payload.hotline, payload.workerMobile, payload.contactPerson, payload.category, payload.email, payload.address, payload.bankName, payload.accountNumber, payload.branch];
                    break;
                case 'ADD_SUPPLIER_PAYMENT':
                    sql = `INSERT INTO "SupplierPayment" (id, supplier_id, purchase_order_id, amount, note, payment_method, cheque_number, cheque_date, cheque_status, date) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) ON CONFLICT (id) DO NOTHING`;
                    params = [payload.id, payload.supplierId, payload.purchaseOrderId, payload.amount, payload.note, payload.paymentMethod, payload.chequeNumber, payload.chequeDate, payload.chequeStatus];
                    break;
                case 'ADD_SUMMARY':
                    sql = `INSERT INTO "MonthlySummary" (id, month, year, total_sales, total_profit, total_expenses, net_profit, date_closed) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`;
                    params = [payload.id, payload.month, payload.year, payload.totalSales, payload.totalProfit, payload.totalExpenses, payload.netProfit, payload.dateClosed];
                    break;
                default:
                    console.warn(`[NeonHTTP] Unhandled sync action: ${action}`);
                    return;
            }

            if (sql) {
                return await neonHttp.query(sql, params);
            }
        } catch (err: any) {
            console.error(`[NeonHTTP] Sync failed for ${action}:`, err.message);
            return { success: false, error: err.message };
        }
    }

};
