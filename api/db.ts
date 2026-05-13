import { pool } from '../services/db';
import { errorHandler } from '../services/errorHandler';
import type { Request, Response } from 'express';

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS "AppUser" (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT, banned BOOLEAN DEFAULT FALSE, banReason TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS "Settings" (id TEXT PRIMARY KEY, business_name TEXT, contact_phone TEXT, address TEXT, logo_url TEXT, currency TEXT, receipt_note TEXT, return_days_limit INT, return_conditions TEXT);
  CREATE TABLE IF NOT EXISTS "Supplier" (id TEXT PRIMARY KEY, name TEXT, phone TEXT, hotline TEXT, worker_mobile TEXT, contact_person TEXT, category TEXT, email TEXT, address TEXT, bank_name TEXT, account_number TEXT, branch TEXT);
  CREATE TABLE IF NOT EXISTS "Product" (id TEXT PRIMARY KEY, name TEXT, barcode TEXT, sku TEXT, cost NUMERIC, price NUMERIC, stock NUMERIC, category TEXT, transport_cost NUMERIC, margin_type TEXT, margin_value NUMERIC, warranty_years INT, warranty_unit TEXT, warranty_cost NUMERIC, warranty_price NUMERIC, has_warranty BOOLEAN, description TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS "Customer" (id TEXT PRIMARY KEY, name TEXT, phone TEXT, nic TEXT, address TEXT, total_loan NUMERIC DEFAULT 0, total_paid NUMERIC DEFAULT 0, balance NUMERIC DEFAULT 0, created_at TIMESTAMP DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS "Bill" (id TEXT PRIMARY KEY, invoice_number TEXT, date TIMESTAMP, customer_id TEXT, customer_name TEXT, subtotal NUMERIC, total_cost NUMERIC, total_profit NUMERIC, discount NUMERIC, total NUMERIC, cash_received NUMERIC, change_returned NUMERIC, payment_type TEXT, archived BOOLEAN DEFAULT FALSE, summary_id TEXT, created_at TIMESTAMP DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS "BillItem" (id TEXT PRIMARY KEY, bill_id TEXT, product_id TEXT, name TEXT, sku TEXT, quantity NUMERIC, cost NUMERIC, price NUMERIC, profit NUMERIC, warranty BOOLEAN, warranty_years INT, warranty_unit TEXT, warranty_price NUMERIC, warranty_cost NUMERIC, discount_type TEXT, discount_value NUMERIC, returned_quantity NUMERIC DEFAULT 0);
  CREATE TABLE IF NOT EXISTS "ReturnRecord" (id TEXT PRIMARY KEY, bill_id TEXT, product_id TEXT, quantity NUMERIC, refund_value NUMERIC, refund_cost NUMERIC, refund_profit NUMERIC, payment_type TEXT, customer_id TEXT, date TIMESTAMP, note TEXT, created_at TIMESTAMP DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS "Expense" (id TEXT PRIMARY KEY, category TEXT, amount NUMERIC, date TIMESTAMP, note TEXT, archived BOOLEAN DEFAULT FALSE, summary_id TEXT, created_at TIMESTAMP DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS "MonthlySummary" (id TEXT PRIMARY KEY, month INT, year INT, total_sales NUMERIC, total_profit NUMERIC, total_expenses NUMERIC, net_profit NUMERIC, date_closed TIMESTAMP, created_at TIMESTAMP DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS "PurchaseOrder" (id TEXT PRIMARY KEY, supplier_id TEXT, supplier_name TEXT, date TIMESTAMP, items JSONB, total_cost NUMERIC, paid_amount NUMERIC, discount_amount NUMERIC, payment_method TEXT, status TEXT, transport_cost NUMERIC, transport_paid_external BOOLEAN, created_at TIMESTAMP DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS "Payment" (id TEXT PRIMARY KEY, customer_id TEXT, amount NUMERIC, date TIMESTAMP, note TEXT, created_at TIMESTAMP DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS "SupplierPayment" (id TEXT PRIMARY KEY, supplier_id TEXT, purchase_order_id TEXT, amount NUMERIC, date TIMESTAMP, note TEXT, payment_method TEXT, cheque_number TEXT, cheque_date TEXT, cheque_status TEXT, created_at TIMESTAMP DEFAULT NOW());
`;

let schemaInitialized = false;

async function ensureSchema() {
  if (schemaInitialized) return;
  try {
    await pool.query(INIT_SQL);
    schemaInitialized = true;
    errorHandler.log('Database', 'Schema verified', { operation: 'ensureSchema' }, 'low');
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    errorHandler.log('Database', error, { operation: 'ensureSchema' }, 'high');
  }
}

// Helper to map snake_case DB results to camelCase for frontend
const toCamel = (o: unknown): unknown => {
  if (!o || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(toCamel);
  
  const newO: Record<string, unknown> = {};
  for (const k in o as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(o, k)) {
      const newK = k.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      newO[newK] = (o as Record<string, unknown>)[k];
    }
  }
  return newO;
};

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ensure tables exist before processing any request
  await ensureSchema();

  const { intent, payload } = req.body;
  const client = await pool.connect();

  try {
    let result;

    switch (intent) {
      // --- Stats & Utils ---
      case 'get_table_stats': {
        const tables = ['Product', 'Customer', 'Bill', 'Supplier', 'Expense', 'ReturnRecord', 'MonthlySummary', 'PurchaseOrder', 'Payment', 'Settings'];
        const stats: Record<string, number> = {};
        for (const t of tables) {
          const resCount = await client.query(`SELECT COUNT(*) as count FROM "${t}"`);
          const countRow = resCount.rows[0] as { count: string } | undefined;
          stats[t.toLowerCase()] = Number(countRow?.count ?? '0');
        }
        result = stats;
        break;
      }
      case 'execute_raw': {
        const rawRes = await client.query(payload.query);
        result = rawRes.rows.map(toCamel);
        break;
      }

      // --- Settings ---
      case 'get_settings': {
        const resSettings = await client.query(`SELECT * FROM "Settings" WHERE id = 'main'`);
        result = toCamel(resSettings.rows[0]);
        break;
      }
      case 'update_settings': {
        const { id, businessName, contactPhone, address, logoUrl, currency, receiptNote, returnDaysLimit, returnConditions } = payload;
        await client.query(
          `INSERT INTO "Settings" (id, business_name, contact_phone, address, logo_url, currency, receipt_note, return_days_limit, return_conditions)
           VALUES ('main', $1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET 
             business_name=$1, contact_phone=$2, address=$3, logo_url=$4, currency=$5, receipt_note=$6, return_days_limit=$7, return_conditions=$8`,
          [businessName, contactPhone, address, logoUrl, currency, receiptNote, returnDaysLimit, returnConditions]
        );
        result = { success: true };
        break;
      }

      // --- Suppliers ---
      case 'get_suppliers':
        result = (await client.query(`SELECT * FROM "Supplier" ORDER BY name ASC`)).rows.map(toCamel);
        break;
      case 'add_supplier': {
        const { id, name, phone, hotline, workerMobile, contactPerson, category, email, address, bankName, accountNumber, branch } = payload;
        await client.query(
          `INSERT INTO "Supplier" (id, name, phone, hotline, worker_mobile, contact_person, category, email, address, bank_name, account_number, branch) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [id, name, phone, hotline, workerMobile, contactPerson, category, email, address, bankName, accountNumber, branch]
        );
        result = { id };
        break;
      }
      case 'update_supplier': {
        const { id, name, phone, hotline, workerMobile, contactPerson, category, email, address, bankName, accountNumber, branch } = payload;
        await client.query(
          `UPDATE "Supplier" SET name=$2, phone=$3, hotline=$4, worker_mobile=$5, contact_person=$6, category=$7, email=$8, address=$9, bank_name=$10, account_number=$11, branch=$12 WHERE id=$1`,
          [id, name, phone, hotline, workerMobile, contactPerson, category, email, address, bankName, accountNumber, branch]
        );
        result = { success: true };
        break;
      }
      case 'delete_supplier':
        await client.query(`DELETE FROM "Supplier" WHERE id=$1`, [payload.id]);
        result = { success: true };
        break;

      // --- Products ---
      case 'get_products':
        result = (await client.query(`SELECT * FROM "Product" ORDER BY name ASC`)).rows.map(toCamel);
        break;
      case 'add_product': {
        const { id, name, barcode, sku, cost, price, stock, category, transportCost, marginType, marginValue, warrantyYears, warrantyUnit, warrantyCost, warrantyPrice, hasWarranty, description } = payload;
        await client.query(
          `INSERT INTO "Product" (id, name, barcode, sku, cost, price, stock, category, transport_cost, margin_type, margin_value, warranty_years, warranty_unit, warranty_cost, warranty_price, has_warranty, description) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [id, name, barcode, sku, cost, price, stock, category, transportCost, marginType, marginValue, warrantyYears, warrantyUnit, warrantyCost, warrantyPrice, hasWarranty, description]
        );
        result = { id };
        break;
      }
      case 'update_product': {
        const { id, name, barcode, sku, cost, price, stock, category, transportCost, marginType, marginValue, warrantyYears, warrantyUnit, warrantyCost, warrantyPrice, hasWarranty, description } = payload;
        await client.query(
          `UPDATE "Product" SET 
             name=$2, barcode=$3, sku=$4, cost=$5, price=$6, stock=$7, 
             category=$8, transport_cost=$9, margin_type=$10, margin_value=$11, 
             warranty_years=$12, warranty_unit=$13, warranty_cost=$14, 
             warranty_price=$15, has_warranty=$16, description=$17 
           WHERE id=$1`,
          [id, name, barcode, sku, cost, price, stock, category, transportCost, marginType, marginValue, warrantyYears, warrantyUnit, warrantyCost, warrantyPrice, hasWarranty, description]
        );
        result = { success: true };
        break;
      }
      case 'delete_product':
        await client.query(`DELETE FROM "Product" WHERE id=$1`, [payload.id]);
        result = { success: true };
        break;

      // --- Customers ---
      case 'get_customers':
        result = (await client.query(`SELECT * FROM "Customer" ORDER BY name ASC`)).rows.map(toCamel);
        break;
      case 'add_customer': {
        const { id, name, phone, nic, address } = payload;
        await client.query(
          `INSERT INTO "Customer" (id, name, phone, nic, address, total_loan, total_paid, balance) VALUES ($1, $2, $3, $4, $5, 0, 0, 0)`,
          [id, name, phone, nic, address]
        );
        result = { id };
        break;
      }
      case 'update_customer': {
        const { id, name, phone, nic, address } = payload;
        await client.query(
          `UPDATE "Customer" SET name=$2, phone=$3, nic=$4, address=$5 WHERE id=$1`,
          [id, name, phone, nic, address]
        );
        result = { success: true };
        break;
      }
      case 'delete_customer':
        await client.query(`DELETE FROM "Customer" WHERE id=$1`, [payload.id]);
        result = { success: true };
        break;

      // --- Bills ---
      case 'get_bills': {
        const { archived, customerId, invoiceNumber, summaryId } = payload;
        let query = `SELECT * FROM "Bill" WHERE 1=1`;
        const params: unknown[] = [];

        if (typeof archived === 'boolean') {
          params.push(archived); query += ` AND archived = $${params.length}`;
        }
        if (customerId) {
          params.push(customerId); query += ` AND customer_id = $${params.length}`;
        }
        if (invoiceNumber) {
          params.push(invoiceNumber); query += ` AND invoice_number = $${params.length}`;
        }
        if (summaryId) {
          params.push(summaryId); query += ` AND summary_id = $${params.length}`;
        }

        query += ` ORDER BY created_at DESC`;

        const billsRes = await client.query(query, params);
        const bills = billsRes.rows.map(toCamel);

        // Fetch Items
        if (bills.length > 0) {
          const billsTyped = bills as Array<{ id: string; items?: unknown[]; customerName?: string }>;
          const billIds = billsTyped.map((b) => b.id);
          // Generate placeholders like $1, $2, $3
          const placeholders = billIds.map((_, i) => `$${i + 1}`).join(',');
          const itemsRes = await client.query(`SELECT * FROM "BillItem" WHERE bill_id IN (${placeholders})`, billIds);
          const items = itemsRes.rows.map(toCamel) as Array<{ billId: string }>;

          // Join items to bills
          for (const bill of billsTyped) {
            bill.items = items.filter((i) => i.billId === bill.id);
            // Ensure customer name is populated (legacy support)
            if (!bill.customerName) bill.customerName = 'CASH SALE';
          }
        }

        result = bills;
        break;
      }
      case 'create_bill': {
        const { bill, items } = payload;
        try {
          await client.query('BEGIN');

          await client.query(
            `INSERT INTO "Bill" (id, invoice_number, date, customer_id, customer_name, subtotal, total_cost, total_profit, discount, total, cash_received, change_returned, payment_type, archived, summary_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [bill.id, bill.invoiceNumber, bill.date, bill.customerId, bill.customerName, bill.subtotal, bill.totalCost, bill.totalProfit, bill.discount, bill.total, bill.cashReceived || 0, bill.changeReturned || 0, bill.paymentType, bill.archived, bill.summaryId]
          );

          for (const i of items) {
            const productId = i.productId.startsWith('CUSTOM') ? null : i.productId;
            await client.query(
              `INSERT INTO "BillItem" (id, bill_id, product_id, name, sku, quantity, cost, price, profit, warranty, warranty_years, warranty_unit, warranty_price, warranty_cost, discount_type, discount_value, returned_quantity)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
              [i.id, bill.id, productId, i.name, i.sku, i.quantity, i.cost, i.price, i.profit, i.warranty, i.warrantyYears, i.warrantyUnit, i.warrantyPrice, i.warrantyCost, 'MANUAL', 0, i.returnedQuantity]
            );

            // Stock decrement for real products
            if (productId) {
              await client.query(`UPDATE "Product" SET stock = stock - $1 WHERE id = $2`, [i.quantity, productId]);
            }
          }

          // Update Customer Balance
          if (bill.customerId) {
            const balanceChange = bill.total - (bill.paid || 0);
            if (balanceChange > 0) {
              await client.query(`UPDATE "Customer" SET balance = balance + $1, total_loan = total_loan + $1 WHERE id = $2`, [balanceChange, bill.customerId]);
            }
          }

          await client.query('COMMIT');
          result = bill.id;
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
        break;
      }
      case 'return_item': {
        const { billId, lineId, qty, itemDetails, billDetails } = payload;
        try {
          await client.query('BEGIN');

          await client.query(`UPDATE "BillItem" SET returned_quantity = returned_quantity + $1 WHERE id = $2`, [qty, lineId]);

          if (itemDetails.productId && !itemDetails.productId.startsWith('CUSTOM')) {
            await client.query(`UPDATE "Product" SET stock = stock + $1 WHERE id = $2`, [qty, itemDetails.productId]);
          }

          const refundVal = itemDetails.price * qty;
          const refundCost = itemDetails.cost * qty;
          const refundProfit = (itemDetails.profit / itemDetails.quantity) * qty;
          const returnId = 'RET-' + Date.now();

          await client.query(
            `INSERT INTO "ReturnRecord" (id, bill_id, product_id, quantity, refund_value, refund_cost, refund_profit, payment_type, customer_id, date, note)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
            [returnId, billId, itemDetails.productId, qty, refundVal, refundCost, refundProfit, billDetails.paymentType || 'CASH', billDetails.customerId, 'Restored to stock']
          );

          await client.query('COMMIT');
          result = { success: true };
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
        break;
      }

      // --- Expenses ---
      case 'get_expenses': {
        const { archived, summaryId } = payload;
        let q = `SELECT * FROM "Expense" WHERE 1=1`;
        const p: unknown[] = [];
        if (typeof archived === 'boolean') { p.push(archived); q += ` AND archived = $${p.length}`; }
        if (summaryId) { p.push(summaryId); q += ` AND summary_id = $${p.length}`; }
        q += ` ORDER BY date DESC, created_at DESC`;
        result = (await client.query(q, p)).rows.map(toCamel);
        break;
      }
      case 'add_expense': {
        const { id, category, amount, note, date, archived, summaryId } = payload;
        await client.query(
          `INSERT INTO "Expense" (id, category, amount, date, note, archived, summary_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, category, amount, date, note, archived, summaryId]
        );
        result = { id };
        break;
      }
      case 'update_expense': {
        const { id, category, amount, note, date } = payload;
        await client.query(`UPDATE "Expense" SET category=$2, amount=$3, note=$4, date=$5 WHERE id=$1`, [id, category, amount, note, date]);
        result = { success: true };
        break;
      }
      case 'delete_expense':
        await client.query(`DELETE FROM "Expense" WHERE id=$1`, [payload.id]);
        result = { success: true };
        break;

      // --- Returns ---
      case 'get_returns': {
        const res = await client.query(`SELECT * FROM "ReturnRecord" ORDER BY created_at DESC`);
        const returns = res.rows.map(toCamel);
        // Note: Product/Customer Names handled by frontend join or separate fetches for lightness, but let's do a simple join if needed.
        // For now, raw data is returned, frontend mockDb maps IDs.
        result = returns;
        break;
      }

      // --- Summaries ---
      case 'get_summaries':
        result = (await client.query(`SELECT * FROM "MonthlySummary" ORDER BY year DESC, month DESC`)).rows.map(toCamel);
        break;
      case 'add_summary': {
        try {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO "MonthlySummary" (id, month, year, total_sales, total_profit, total_expenses, net_profit, date_closed)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [payload.id, payload.month, payload.year, payload.totalSales, payload.totalProfit, payload.totalExpenses, payload.netProfit, payload.dateClosed]
          );
          await client.query(`UPDATE "Bill" SET archived=TRUE, summary_id=$1 WHERE archived=FALSE`, [payload.id]);
          await client.query(`UPDATE "Expense" SET archived=TRUE, summary_id=$1 WHERE archived=FALSE`, [payload.id]);
          await client.query('COMMIT');
        } catch (e: unknown) { 
          await client.query('ROLLBACK'); 
          const error = e instanceof Error ? e : new Error(String(e));
          errorHandler.log('Database', error, { operation: 'add_summary' }, 'high');
          throw error; 
        }
        break;
      }

      // --- Purchase Orders ---
      case 'get_purchase_orders':
        result = (await client.query(`SELECT * FROM "PurchaseOrder" ORDER BY created_at DESC`)).rows.map(toCamel);
        break;
      case 'add_purchase_order': {
        const { id, supplierId, supplierName, items, totalCost, paidAmount, paymentMethod, status, transportCost, transportPaidExternal } = payload;
        await client.query(
          `INSERT INTO "PurchaseOrder" (id, supplier_id, supplier_name, date, items, total_cost, paid_amount, discount_amount, payment_method, status, transport_cost, transport_paid_external)
           VALUES ($1, $2, $3, NOW(), $4, $5, $6, 0, $7, $8, $9, $10)`,
          [id, supplierId, supplierName, JSON.stringify(items), totalCost, paidAmount, paymentMethod, status, transportCost, transportPaidExternal]
        );
        result = { id };
        break;
      }
      case 'update_purchase_order': {
        const { id, items, totalCost, paidAmount, paymentMethod, status, transportCost, transportPaidExternal } = payload;
        await client.query(
          `UPDATE "PurchaseOrder" SET items=$2, total_cost=$3, paid_amount=$4, payment_method=$5, status=$6, transport_cost=$7, transport_paid_external=$8 WHERE id=$1`,
          [id, JSON.stringify(items), totalCost, paidAmount, paymentMethod, status, transportCost, transportPaidExternal]
        );
        result = { success: true };
        break;
      }
      case 'delete_purchase_order':
        await client.query(`DELETE FROM "PurchaseOrder" WHERE id=$1`, [payload.id]);
        result = { success: true };
        break;

      // --- Payments ---
      case 'get_payments':
        result = (await client.query(`SELECT * FROM "Payment" WHERE customer_id=$1 ORDER BY created_at DESC`, [payload.customerId])).rows.map(toCamel);
        break;
      case 'add_payment': {
        try {
          await client.query('BEGIN');
          await client.query(`INSERT INTO "Payment" (id, customer_id, amount, date, note) VALUES ($1, $2, $3, $4, $5)`, [payload.id, payload.customerId, payload.amount, new Date(), payload.note]);
          await client.query(`UPDATE "Customer" SET balance = balance - $1, total_paid = total_paid + $1 WHERE id=$2`, [payload.amount, payload.customerId]);
          await client.query('COMMIT');
          result = { id: payload.id };
        } catch (e: unknown) { 
          await client.query('ROLLBACK'); 
          const error = e instanceof Error ? e : new Error(String(e));
          errorHandler.log('Database', error, { operation: 'add_payment' }, 'high');
          throw error; 
        }
        break;
      }
      case 'update_payment': {
        try {
          await client.query('BEGIN');
          await client.query(`UPDATE "Payment" SET amount=$2, note=$3 WHERE id=$1`, [payload.id, payload.newAmount, payload.note]);
          await client.query(`UPDATE "Customer" SET balance = balance - $1, total_paid = total_paid + $1 WHERE id=$2`, [payload.diff, payload.customerId]);
          await client.query('COMMIT');
        } catch (e: unknown) { 
          await client.query('ROLLBACK'); 
          const error = e instanceof Error ? e : new Error(String(e));
          errorHandler.log('Database', error, { operation: 'update_payment' }, 'high');
          throw error; 
        }
        break;
      }
      case 'delete_payment': {
        try {
          await client.query('BEGIN');
          await client.query(`DELETE FROM "Payment" WHERE id=$1`, [payload.id]);
          await client.query(`UPDATE "Customer" SET balance = balance + $1, total_paid = total_paid - $1 WHERE id=$2`, [payload.amount, payload.customerId]);
          await client.query('COMMIT');
        } catch (e: unknown) { 
          await client.query('ROLLBACK'); 
          const error = e instanceof Error ? e : new Error(String(e));
          errorHandler.log('Database', error, { operation: 'delete_payment' }, 'high');
          throw error; 
        }
        break;
      }

      // --- Supplier Payments ---
      case 'get_supplier_payments':
        result = (await client.query(`SELECT * FROM "SupplierPayment" WHERE supplier_id=$1 ORDER BY created_at DESC`, [payload.supplierId])).rows.map(toCamel);
        break;
      case 'add_supplier_payment': {
        const { id, supplierId, purchaseOrderId, amount, note, paymentMethod, chequeNumber, chequeDate, chequeStatus } = payload;
        try {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO "SupplierPayment" (id, supplier_id, purchase_order_id, amount, date, note, payment_method, cheque_number, cheque_date, cheque_status)
              VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)`,
            [id, supplierId, purchaseOrderId, amount, note, paymentMethod, chequeNumber, chequeDate, chequeStatus]
          );
          if (purchaseOrderId) {
            await client.query(`UPDATE "PurchaseOrder" SET paid_amount = paid_amount + $1 WHERE id=$2`, [amount, purchaseOrderId]);
          }
          await client.query('COMMIT');
          result = { id };
        } catch (e: unknown) { 
          await client.query('ROLLBACK'); 
          const error = e instanceof Error ? e : new Error(String(e));
          errorHandler.log('Database', error, { operation: 'add_supplier_payment' }, 'high');
          throw error; 
        }
        break;
      }
      case 'update_supplier_payment': {
        const { id, oldAmount, newAmount, note, paymentMethod, purchaseOrderId } = payload;
        try {
          await client.query('BEGIN');
          const oldRecRes = await client.query(`SELECT purchase_order_id FROM "SupplierPayment" WHERE id=$1`, [id]);
          const oldRecRow = oldRecRes.rows[0];
          const oldPoId = oldRecRow ? (oldRecRow as { purchase_order_id?: string }).purchase_order_id : undefined;

          if (oldPoId) {
            await client.query(`UPDATE "PurchaseOrder" SET paid_amount = paid_amount - $1 WHERE id=$2`, [oldAmount, oldPoId]);
          }
          await client.query(`UPDATE "SupplierPayment" SET amount=$2, note=$3, payment_method=$4, purchase_order_id=$5 WHERE id=$1`, [id, newAmount, note, paymentMethod, purchaseOrderId]);
          if (purchaseOrderId) {
            await client.query(`UPDATE "PurchaseOrder" SET paid_amount = paid_amount + $1 WHERE id=$2`, [newAmount, purchaseOrderId]);
          }
          await client.query('COMMIT');
        } catch (e: unknown) { 
          await client.query('ROLLBACK'); 
          const error = e instanceof Error ? e : new Error(String(e));
          errorHandler.log('Database', error, { operation: 'update_supplier_payment' }, 'high');
          throw error; 
        }
        break;
      }
      case 'delete_supplier_payment': {
        try {
          await client.query('BEGIN');
          const rec = (await client.query(`SELECT * FROM "SupplierPayment" WHERE id=$1`, [payload.id])).rows[0] as { purchase_order_id?: string; amount?: number } | undefined;
          if (rec && rec.purchase_order_id && rec.amount) {
            await client.query(`UPDATE "PurchaseOrder" SET paid_amount = paid_amount - $1 WHERE id=$2`, [rec.amount, rec.purchase_order_id]);
          }
          await client.query(`DELETE FROM "SupplierPayment" WHERE id=$1`, [payload.id]);
          await client.query('COMMIT');
        } catch (e: unknown) { 
          await client.query('ROLLBACK'); 
          const error = e instanceof Error ? e : new Error(String(e));
          errorHandler.log('Database', error, { operation: 'delete_supplier_payment' }, 'high');
          throw error; 
        }
        break;
      }
      case 'update_cheque_status':
        await client.query(`UPDATE "SupplierPayment" SET cheque_status=$2 WHERE id=$1`, [payload.id, payload.status]);
        result = { success: true };
        break;

      default:
        return res.status(400).json({ error: 'Invalid intent' });
    }

    res.json({ result });

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    errorHandler.log('Database', error, { operation: intent }, 'high');
    res.status(500).json({ error: error.message || 'Database operation failed' });
  } finally {
    client.release();
  }
}
