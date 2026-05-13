import { pool } from './db';
import { encryptData, decryptData } from './encryption';
import { Product, Customer, Bill, MarginType, Payment, BusinessSettings, Supplier, PurchaseOrder, Expense, MonthlySummary, BillItem, ReturnRecord, SupplierPayment, PurchaseOrderItem, PurchaseOrderStatus, ProductRequest } from '../types';
import { errorHandler } from './errorHandler';
import { cloudDb } from './cloudDb';
import { neonHttp } from './neonHttp';

// --- UTILS ---
const toCamel = (o: any) => {
  if (!o) return null;
  const newO: any = {};
  for (const k in o) {
    const newK = k.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newO[newK] = o[k];
  }
  return newO;
};

const toNum = (val: any) => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

// --- MAPPERS ---
const mapProduct = (row: any): Product => ({
  id: String(row.id),
  name: String(row.name || ''),
  category: String(row.category || 'General'),
  barcode: row.barcode || undefined,
  sku: row.sku || row.product_code || undefined,
  cost: toNum(row.cost),
  transportCost: toNum(row.transportCost),
  totalCost: toNum(row.cost) + toNum(row.transportCost),
  marginType: (row.marginType || MarginType.MANUAL) as MarginType,
  marginValue: toNum(row.marginValue),
  price: toNum(row.price),
  stock: toNum(row.stock),
  warrantyYears: toNum(row.warrantyYears),
  warrantyUnit: (row.warrantyUnit || 'YEARS') as any,
  warrantyCost: toNum(row.warrantyCost),
  warrantyPrice: toNum(row.warrantyPrice),
  hasWarranty: Boolean(row.hasWarranty),
  description: row.description || '',
});

const mapCustomer = (row: any): Customer => ({
  id: String(row.id),
  name: String(row.name || ''),
  phone: String(row.phone || ''),
  nic: row.nic || undefined,
  address: row.address || undefined,
  totalLoan: toNum(row.totalLoan),
  totalPaid: toNum(row.totalPaid),
  balanceDue: toNum(row.balance),
  language: (row.language || 'en') as 'en' | 'ta' | 'si',
});

const mapBillItem = (row: any): BillItem => ({
  lineId: String(row.id),
  billId: row.billId ? String(row.billId) : undefined,
  productId: String(row.productId),
  name: String(row.name || ''),
  sku: row.sku || undefined,
  quantity: toNum(row.quantity),
  returnedQty: toNum(row.returnedQuantity),
  cost: toNum(row.cost),
  price: toNum(row.price),
  profit: toNum(row.profit),
  warranty: Boolean(row.warranty),
  warrantyYears: toNum(row.warrantyYears),
  warrantyUnit: (row.warrantyUnit || 'YEARS') as any,
  warrantyPrice: toNum(row.warrantyPrice),
  warrantyCost: toNum(row.warrantyCost),
});

const mapBill = (row: any): Bill => ({
  id: String(row.id),
  invoiceNumber: String(row.invoiceNumber || ''),
  date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
  customerId: row.customerId ? String(row.customerId) : null,
  customerName: row.customerName || 'CASH SALE',
  items: Array.isArray(row.items) ? row.items.map(mapBillItem) : [],
  subtotal: toNum(row.subtotal),
  totalCost: toNum(row.totalCost),
  totalProfit: toNum(row.totalProfit),
  discount: toNum(row.discount),
  total: toNum(row.total),
  cashReceived: toNum(row.cashReceived),
  changeReturned: toNum(row.changeReturned),
  paymentType: (row.paymentType || 'CASH') as any,
  dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : undefined,
  archived: Boolean(row.archived),
  summaryId: row.summaryId || undefined,
});

const mapExpense = (row: any): Expense => ({
  id: String(row.id),
  category: String(row.category || 'General'),
  amount: toNum(row.amount),
  date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
  note: String(row.note || ''),
  archived: Boolean(row.archived),
  summaryId: row.summaryId || undefined
});

const mapSupplier = (row: any): Supplier => ({
  id: String(row.id),
  name: row.name || '',
  phone: row.phone || '',
  hotline: row.hotline || '',
  workerMobile: row.workerMobile || '',
  contactPerson: row.contactPerson || '',
  category: row.category || 'General',
  email: row.email || '',
  address: row.address || '',
  bankName: row.bankName || '',
  accountNumber: row.accountNumber || '',
  branch: row.branch || ''
});

const mapProductRequest = (row: any): ProductRequest => ({
  id: String(row.id),
  itemName: String(row.itemName || ''),
  quantity: toNum(row.quantity) || 1,
  customerId: row.customerId || null,
  customerName: row.customerName || '',
  customerPhone: row.customerPhone || '',
  note: row.note || '',
  status: row.status || 'OPEN',
  createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  orderedPurchaseOrderId: row.orderedPurchaseOrderId || undefined
});

const mapPayment = (row: any): Payment => ({
  id: String(row.id),
  customerId: String(row.customerId),
  amount: toNum(row.amount),
  date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
  note: String(row.note || '')
});

const mapSupplierPayment = (row: any): SupplierPayment => ({
  id: String(row.id),
  supplierId: String(row.supplierId),
  purchaseOrderId: row.purchaseOrderId,
  amount: toNum(row.amount),
  date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
  note: String(row.note || ''),
  paymentMethod: row.paymentMethod || 'CASH',
  chequeNumber: row.chequeNumber,
  chequeDate: row.chequeDate,
  chequeStatus: row.chequeStatus
});

const mapPurchaseOrder = (row: any): PurchaseOrder => ({
  id: String(row.id),
  supplierId: String(row.supplierId),
  supplierName: String(row.supplierName),
  date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
  items: (row.items as any as PurchaseOrderItem[]) || [],
  totalCost: toNum(row.totalCost),
  paidAmount: toNum(row.paidAmount),
  discountAmount: toNum(row.discountAmount),
  paymentMethod: (row.paymentMethod || 'CASH') as any,
  status: row.status as PurchaseOrderStatus,
  transportCost: toNum(row.transportCost),
  transportPaidExternal: Boolean(row.transportPaidExternal)
});

const mapReturnRecord = (row: any): ReturnRecord => ({
  id: String(row.id),
  billId: String(row.billId),
  productId: String(row.productId),
  productName: String(row.productName || ''),
  quantity: toNum(row.quantity),
  refundValue: toNum(row.refundValue),
  refundCost: toNum(row.refundCost),
  refundProfit: toNum(row.refundProfit),
  paymentType: String(row.paymentType),
  customerId: row.customerId ? String(row.customerId) : null,
  customerName: String(row.customerName || ''),
  date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
  note: String(row.note || '')
});

const mapMonthlySummary = (row: any): MonthlySummary => ({
  id: String(row.id),
  month: Number(row.month),
  year: Number(row.year),
  totalSales: toNum(row.totalSales),
  totalProfit: toNum(row.totalProfit),
  totalExpenses: toNum(row.totalExpenses),
  netProfit: toNum(row.netProfit),
  dateClosed: row.dateClosed ? new Date(row.dateClosed).toISOString() : new Date().toISOString()
});

const mapSettings = (row: any): BusinessSettings => ({
  id: String(row.id),
  businessName: String(row.businessName || 'WR POS'),
  currency: String(row.currency || 'LKR'),
  returnDaysLimit: Number(row.returnDaysLimit ?? 3),
  returnConditions: String(row.returnConditions || ''),
  address: String(row.address || ''),
  contactPhone: String(row.contactPhone || ''),
  logoUrl: String(row.logoUrl || ''),
  receiptNote: String(row.receiptNote || '')
});

const LOCAL_KEYS = {
  DATA: 'wr_pos_data_cache_v2',
  SYNC_QUEUE: 'wr_pos_sync_queue_v2'
};

interface DbCache {
  products: Product[];
  customers: Customer[];
  bills: Bill[];
  settings: BusinessSettings | null;
  expenses: Expense[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  payments: Payment[];
  supplierPayments: SupplierPayment[];
  productRequests: ProductRequest[];
  returns: ReturnRecord[];
  summaries: MonthlySummary[];
}

export interface DB {
  setAuthToken: (token: string) => void;
  init: () => Promise<boolean>;
  isOffline: () => boolean;
  setOffline: (status: boolean) => void;
  system: {
    syncPending: () => Promise<void>;
    getBackupData: () => Promise<{ meta: { date: string; version: string }; data: DbCache }>;
    restoreBackupData: (json: any) => Promise<void>;
  };
  getTableStats: () => Promise<{ product: number; customer: number; bill: number; expense: number }>;
  executeRaw: (q: string) => Promise<any[]>;
  settings: {
    get: () => Promise<BusinessSettings>;
    update: (s: BusinessSettings) => Promise<void>;
  };
  products: {
    getAll: () => Promise<Product[]>;
    get: (id: string) => Promise<Product | undefined>;
    add: (p: Partial<Product>) => Promise<string>;
    update: (p: Product) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  productRequests: {
    getAll: () => Promise<ProductRequest[]>;
    getOpen: () => Promise<ProductRequest[]>;
    add: (request: Partial<ProductRequest>) => Promise<string>;
    update: (request: ProductRequest) => Promise<void>;
    markOrdered: (ids: string[], purchaseOrderId?: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  customers: {
    getAll: () => Promise<Customer[]>;
    get: (id: string) => Promise<Customer | undefined>;
    add: (c: Partial<Customer>) => Promise<string>;
    create: (c: Partial<Customer>) => Promise<string>;
    update: (c: Customer) => Promise<void>;
    delete: (id: string) => Promise<void>;
    recalculateBalance: (id: string) => Promise<{ balance: number; totalPaid: number }>;
  };
  bills: {
    getAll: (archived?: boolean) => Promise<Bill[]>;
    getAllForCustomer: (cid: string) => Promise<Bill[]>;
    getByInvoiceNumber: (inv: string) => Promise<Bill | null>;
    create: (bill: Bill) => Promise<string>;
    returnItem: (billId: string, lineId: string, qty: number) => Promise<void>;
    returnUnlinkedItem: (productId: string, qty: number, price: number, cost: number, paymentType: string, customerId?: string) => Promise<void>;
  };
  expenses: {
    getAll: () => Promise<Expense[]>;
    add: (e: Partial<Expense>) => Promise<string>;
    update: (e: Expense) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  reminders: {
    getOverdueBills: () => Promise<any[]>;
  };
  suppliers: {
    getAll: () => Promise<Supplier[]>;
    add: (s: Partial<Supplier>) => Promise<string>;
    update: (s: Supplier) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  purchaseOrders: {
    getAll: () => Promise<PurchaseOrder[]>;
    add: (po: Partial<PurchaseOrder>) => Promise<string>;
    update: (po: PurchaseOrder) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  payments: {
    getAll: () => Promise<Payment[]>;
    getByCustomerId: (cid: string) => Promise<Payment[]>;
    add: (p: Partial<Payment>) => Promise<string>;
    update: (id: string, cid: string, oldAmount: number, newAmount: number, note: string) => Promise<void>;
    delete: (id: string, cid: string, amount: number) => Promise<void>;
  };
  supplierPayments: {
    getAll: () => Promise<SupplierPayment[]>;
    getBySupplierId: (sid: string) => Promise<SupplierPayment[]>;
    add: (p: Partial<SupplierPayment>) => Promise<string>;
    update: (id: string, oldAmount: number, newAmount: number, note: string, method: string, poId?: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
    updateStatus: (id: string, status: string) => Promise<void>;
  };
  returns: {
    getAll: () => Promise<ReturnRecord[]>;
  };
  summaries: {
    getAll: () => Promise<MonthlySummary[]>;
    add: (s: MonthlySummary) => Promise<void>;
    getArchivedBills: (id: string) => Promise<Bill[]>;
    getArchivedExpenses: (id: string) => Promise<Expense[]>;
  };
}

const safeArray = <T>(value: any): T[] => Array.isArray(value) ? value : [];
const safeObject = <T>(value: any, defaultValue: T): T => (value && typeof value === 'object' && !Array.isArray(value)) ? value : defaultValue;

const sanitizeDbCache = (input: Partial<DbCache>): DbCache => ({
  products: safeArray<Product>(input.products),
  customers: safeArray<Customer>(input.customers),
  bills: safeArray<Bill>(input.bills),
  settings: safeObject<BusinessSettings | null>(input.settings, null),
  expenses: safeArray<Expense>(input.expenses),
  suppliers: safeArray<Supplier>(input.suppliers),
  purchaseOrders: safeArray<PurchaseOrder>(input.purchaseOrders),
  payments: safeArray<Payment>(input.payments),
  supplierPayments: safeArray<SupplierPayment>(input.supplierPayments),
  productRequests: safeArray<ProductRequest>(input.productRequests),
  returns: safeArray<ReturnRecord>(input.returns),
  summaries: safeArray<MonthlySummary>(input.summaries),
});

const isInventoryTrackedProduct = (productId?: string | null) => {
  if (!productId) return false;
  return !productId.startsWith('CUSTOM') && !productId.startsWith('SERVICE') && !productId.startsWith('manual-');
};

const applyLocalStockDelta = (productId: string, delta: number) => {
  const productIndex = dbCache.products.findIndex((product: any) => String(product.id) === String(productId));
  if (productIndex === -1) return;

  const current = dbCache.products[productIndex];
  const nextProducts = [...dbCache.products];
  nextProducts[productIndex] = {
    ...current,
    stock: toNum(current.stock) + delta,
  };
  dbCache.products = nextProducts;
};

let dbCache: DbCache = {
  products: [],
  customers: [],
  bills: [],
  settings: null,
  expenses: [],
  suppliers: [],
  purchaseOrders: [],
  payments: [],
  supplierPayments: [],
  productRequests: [],
  returns: [],
  summaries: []
};

let isOfflineMode = false;
const isCapacitorRuntime = () => !!(window as any).Capacitor?.isNativePlatform?.();
const isDesktopRuntime = () => !!(window as any).electronAPI;
const canUseRestFallback = () => !isDesktopRuntime() && isCapacitorRuntime() && neonHttp.isUsable();
const isTransientDbError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|terminated|ENOTFOUND|ECONNRESET|ECONNREFUSED|network/i.test(message);
};

const SyncEngine = {
  loadLocal: () => {
    try {
      const saved = localStorage.getItem(LOCAL_KEYS.DATA);
      if (saved) {
        const decryptedData = decryptData(saved);
        if (decryptedData) {
          try {
            const parsed = JSON.parse(decryptedData) as Partial<DbCache>;
            dbCache = { ...dbCache, ...sanitizeDbCache(parsed) };
          } catch (jsonErr) {
            if (decryptedData.includes('[object Object]')) {
              console.warn('[SyncEngine] Defect detected: "[object Object]" found in neural cache. Cleaning...');
            } else {
              throw jsonErr;
            }
          }
        } else {
          // Fallback for legacy unencrypted data during transition
          const parsed = JSON.parse(saved) as Partial<DbCache>;
          dbCache = { ...dbCache, ...sanitizeDbCache(parsed) };
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (!err.message.includes('Malformed') && !err.message.includes('Unexpected token')) {
        errorHandler.log('SyncEngine', err, { operation: 'loadLocal' }, 'medium');
      }
    }
  },

  saveLocal: () => {
    try {
      const serialized = JSON.stringify(dbCache);
      const encrypted = encryptData(serialized);
      localStorage.setItem(LOCAL_KEYS.DATA, encrypted);
      console.log('[SyncEngine] Local cache saved.');
    } catch (e) {
      errorHandler.log('SyncEngine', e, { operation: 'saveLocal' }, 'high');
    }
  },

  addToQueue: (action: string, payload: any) => {
    try {
      if (typeof payload === 'string' && payload === '[object Object]') {
        console.error('[SyncEngine] REJECTED: Attempted to queue a malformed object string.');
        return;
      }
      const rawQueue = localStorage.getItem(LOCAL_KEYS.SYNC_QUEUE) || '[]';
      if (rawQueue.includes('[object Object]')) {
        console.warn('[SyncEngine] Corrupted sync queue detected. Resetting for safety.');
        localStorage.setItem(LOCAL_KEYS.SYNC_QUEUE, '[]');
        return;
      }
      const queue = JSON.parse(rawQueue);
      queue.push({ id: generateId(), action, payload, timestamp: Date.now() });
      localStorage.setItem(LOCAL_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    } catch (e) {
      errorHandler.log('SyncEngine', e, { operation: 'addToQueue' }, 'high');
    }
  },

  processQueue: async () => {
    if (isOfflineMode) return;
    try {
      const rawQueue = JSON.parse(localStorage.getItem(LOCAL_KEYS.SYNC_QUEUE) || '[]');
      const queue = Array.isArray(rawQueue) ? rawQueue : [];
      if (queue.length === 0) return;

      const newQueue = [];
      for (const item of queue) {
        try {
          await executeCloudOperation(item.action, item.payload);
        } catch (e) {
          if (isTransientDbError(e)) {
            console.warn('[SyncEngine] Database temporarily unavailable. Keeping pending sync queue for later.');
            isOfflineMode = true;
            newQueue.push(item, ...queue.slice(queue.indexOf(item) + 1));
            break;
          }
          errorHandler.log('SyncEngine', e, { operation: 'processQueueItem', action: item.action }, 'medium');
          newQueue.push(item);
        }
      }
      localStorage.setItem(LOCAL_KEYS.SYNC_QUEUE, JSON.stringify(newQueue));
    } catch (e) {
      errorHandler.log('SyncEngine', e, { operation: 'processQueue' }, 'high');
    }
  },

  syncAll: async () => {
    if (isOfflineMode) return;
    try {
      const fetchEntities = async () => {
        try {
          const [p, c, s, e, po, pay, ret, sum, sup, req] = await Promise.all([
            pool.query(`SELECT * FROM "Product" ORDER BY name ASC`),
            pool.query(`SELECT * FROM "Customer" ORDER BY name ASC`),
            pool.query(`SELECT * FROM "Settings" WHERE id = 'main'`),
            pool.query(`SELECT * FROM "Expense" WHERE archived = FALSE ORDER BY date DESC LIMIT 100`),
            pool.query(`SELECT * FROM "PurchaseOrder" ORDER BY created_at DESC LIMIT 100`),
            pool.query(`SELECT * FROM "Payment" ORDER BY created_at DESC LIMIT 100`),
            pool.query(`SELECT * FROM "ReturnRecord" ORDER BY created_at DESC LIMIT 100`),
            pool.query(`SELECT * FROM "MonthlySummary" ORDER BY year DESC, month DESC`),
            pool.query(`SELECT * FROM "Supplier" ORDER BY name ASC`),
            pool.query(`SELECT * FROM "ProductRequest" ORDER BY created_at DESC LIMIT 500`)
          ]);

          dbCache.products = (p?.rows || []).map((r: any) => mapProduct(toCamel(r)));
          dbCache.customers = (c?.rows || []).map((r: any) => mapCustomer(toCamel(r)));
          if (s?.rows?.[0]) dbCache.settings = mapSettings(toCamel(s.rows[0]));
          dbCache.expenses = (e?.rows || []).map((r: any) => mapExpense(toCamel(r)));
          dbCache.purchaseOrders = (po?.rows || []).map((r: any) => mapPurchaseOrder(toCamel(r)));
          dbCache.payments = (pay?.rows || []).map((r: any) => mapPayment(toCamel(r)));
          dbCache.returns = (ret?.rows || []).map((r: any) => mapReturnRecord(toCamel(r)));
          dbCache.summaries = (sum?.rows || []).map((r: any) => mapMonthlySummary(toCamel(r)));
          dbCache.suppliers = (sup?.rows || []).map((r: any) => mapSupplier(toCamel(r)));
          dbCache.productRequests = (req?.rows || []).map((r: any) => mapProductRequest(toCamel(r)));

          SyncEngine.saveLocal();
        } catch (err) {
          if (isTransientDbError(err)) {
            console.warn('[SyncEngine] Cloud sync temporarily unavailable. Continuing in Offline Mode.');
          } else {
            errorHandler.log('SyncEngine', err, { operation: 'fetchEntities' }, 'high');
          }

          // Mobile Fallback: Attempt fetch via REST if pool fails
          if (canUseRestFallback()) {
            console.log('[SyncEngine] Pool failed on mobile, attempting REST discovery...');
            // TODO: Implement full REST fetch if needed, for now we rely on local + individual syncs
          }

          isOfflineMode = true;
        }
      };
      await fetchEntities();
    } catch (e) {
      errorHandler.log('SyncEngine', e, { operation: 'syncAll' }, 'critical');
      isOfflineMode = true;
    }
  }
};

const executeCloudOperation = async (action: string, payload: any) => {
  // Mobile fallback only: desktop builds should stay on the Electron/Postgres path.
  if (canUseRestFallback()) {
    console.log(`[mockDb] Mobile detected, using REST sync for ${action}`);
    await neonHttp.syncAction(action, payload);
    return;
  }

  const client = await pool.connect();
  try {
    switch (action) {
      case 'ADD_BILL':
        const { bill } = payload;
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO "Bill" (id, invoice_number, date, customer_id, customer_name, subtotal, total_cost, total_profit, discount, total, cash_received, change_returned, payment_type, due_date, archived, summary_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             ON CONFLICT (id) DO NOTHING`,
          [bill.id, bill.invoiceNumber, bill.date, bill.customerId, bill.customerName, bill.subtotal, bill.totalCost, bill.totalProfit, bill.discount, bill.total, bill.cashReceived, bill.changeReturned, bill.paymentType, bill.dueDate, false, null]
        );
        for (const i of bill.items) {
          const productId = i.productId.startsWith('CUSTOM') || i.productId.startsWith('SERVICE') ? null : i.productId;
          await client.query(
            `INSERT INTO "BillItem" (id, bill_id, product_id, name, sku, quantity, cost, price, profit, warranty, warranty_years, warranty_unit, warranty_price, warranty_cost, discount_type, discount_value, returned_quantity)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (id) DO NOTHING`,
            [generateId(), bill.id, productId, i.name, i.sku, i.quantity, i.cost, i.price, i.profit, i.warranty, i.warrantyYears, i.warrantyUnit, i.warrantyPrice, i.warrantyCost, 'MANUAL', 0, 0]
          );
          if (productId) {
            await client.query(`UPDATE "Product" SET stock = stock - $1 WHERE id = $2`, [i.quantity, productId]);
          }
        }
        if (bill.customerId) {
          const balanceChange = bill.total - (bill.cashReceived || 0);
          const cashReceived = bill.cashReceived || 0;
          if (balanceChange > 0 || cashReceived > 0) {
            // Update balance and loan when there's outstanding amount
            if (balanceChange > 0) {
              await client.query(`UPDATE "Customer" SET balance = balance + $1, total_loan = total_loan + $1 WHERE id = $2`, [balanceChange, bill.customerId]);
            }
            // Update total_paid when there's partial payment
            if (cashReceived > 0) {
              await client.query(`UPDATE "Customer" SET total_paid = total_paid + $1 WHERE id = $2`, [cashReceived, bill.customerId]);
            }
          }
        }
        await client.query('COMMIT');
        // Firestore Sync
        await cloudDb.syncToCloud('bills', bill.id, bill);
        // Neon REST Sync
        await neonHttp.syncAction('ADD_BILL', { bill });
        break;

      case 'ADD_CUSTOMER':
        await client.query(
          `INSERT INTO "Customer" (id, name, phone, nic, address, total_loan, total_paid, balance, language)
             VALUES ($1, $2, $3, $4, $5, 0, 0, 0, $6)
             ON CONFLICT (phone) DO UPDATE SET
               name=COALESCE(NULLIF(EXCLUDED.name, ''), "Customer".name),
               nic=COALESCE(NULLIF(EXCLUDED.nic, ''), "Customer".nic),
               address=COALESCE(NULLIF(EXCLUDED.address, ''), "Customer".address),
               language=COALESCE(EXCLUDED.language, "Customer".language)`,
          [payload.id, payload.name, payload.phone, payload.nic, payload.address, payload.language || 'en']
        );
        if (payload.id) await cloudDb.syncToCloud('customers', payload.id, payload);
        await neonHttp.syncAction('ADD_CUSTOMER', payload);
        break;

      case 'ADD_PRODUCT':
        const p = payload;
        await client.query(
          `INSERT INTO "Product" (id, name, barcode, sku, cost, price, stock, category, transport_cost, margin_type, margin_value, warranty_years, warranty_unit, warranty_cost, warranty_price, has_warranty, description) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
             ON CONFLICT (id) DO UPDATE SET
               name=$2, barcode=$3, sku=$4, cost=$5, price=$6, stock=$7, category=$8, transport_cost=$9, margin_type=$10, margin_value=$11, warranty_years=$12, warranty_unit=$13, warranty_cost=$14, warranty_price=$15, has_warranty=$16, description=$17`,
          [p.id, p.name, p.barcode, p.sku, p.cost, p.price, p.stock, p.category, p.transportCost, p.marginType, p.marginValue, p.warrantyYears, p.warrantyUnit, p.warrantyCost, p.warrantyPrice, p.hasWarranty, p.description]
        );
        if (p.id) await cloudDb.syncToCloud('products', p.id, p);
        await neonHttp.syncAction('ADD_PRODUCT', p);
        break;

      case 'ADD_PRODUCT_REQUEST':
        const req = payload;
        await client.query(
          `INSERT INTO "ProductRequest" (id, item_name, quantity, customer_id, customer_name, customer_phone, note, status, ordered_purchase_order_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamp, NOW()), NOW())
             ON CONFLICT (id) DO UPDATE SET
               item_name=$2,
               quantity=$3,
               customer_id=$4,
               customer_name=$5,
               customer_phone=$6,
               note=$7,
               status=$8,
               ordered_purchase_order_id=$9,
               updated_at=NOW()`,
          [req.id, req.itemName, req.quantity, req.customerId || null, req.customerName || '', req.customerPhone || '', req.note || '', req.status || 'OPEN', req.orderedPurchaseOrderId || null, req.createdAt]
        );
        if (req.id) await cloudDb.syncToCloud('productRequests', req.id, req);
        await neonHttp.syncAction('ADD_PRODUCT_REQUEST', req);
        break;

      case 'ADD_CUSTOMER_FULL':
        const cust = payload;
        await client.query(
          `INSERT INTO "Customer" (id, name, phone, nic, address, total_loan, total_paid, balance, language) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
             ON CONFLICT (phone) DO UPDATE SET
               name=$2,
               nic=$4,
               address=$5,
               total_loan=GREATEST("Customer".total_loan, $6),
               total_paid=GREATEST("Customer".total_paid, $7),
               balance=GREATEST("Customer".balance, $8),
               language=$9`,
          [cust.id, cust.name, cust.phone, cust.nic, cust.address, cust.totalLoan, cust.totalPaid, cust.balanceDue, cust.language || 'en']
        );
        if (cust.id) await cloudDb.syncToCloud('customers', cust.id, cust);
        await neonHttp.syncAction('ADD_CUSTOMER_FULL', cust);
        break;

      case 'UPDATE_PO_STATUS':
        await client.query(`UPDATE "PurchaseOrder" SET status=$2, paid_amount=$3, total_cost=$4 WHERE id=$1`, [payload.id, payload.status, payload.paidAmount, payload.totalCost]);
        if (payload.id) await cloudDb.syncToCloud('purchaseOrders', payload.id, payload);
        await neonHttp.syncAction('UPDATE_PO_STATUS', payload);
        break;

      case 'ADD_PAYMENT':
        await client.query(
          `INSERT INTO "Payment" (id, customer_id, amount, date, note) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
          [payload.id, payload.customerId, payload.amount, payload.date, payload.note]
        );
        await client.query(`UPDATE "Customer" SET balance = GREATEST(0, balance - $1), total_paid = total_paid + $1, total_loan = GREATEST(0, total_loan - $1) WHERE id=$2`, [payload.amount, payload.customerId]);
        if (payload.id) await cloudDb.syncToCloud('payments', payload.id, payload);
        await neonHttp.syncAction('ADD_PAYMENT', payload);
        break;

      case 'ADD_EXPENSE':
        await client.query(
          `INSERT INTO "Expense" (id, category, amount, date, note) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
          [payload.id, payload.category, payload.amount, payload.date, payload.note]
        );
        if (payload.id) await cloudDb.syncToCloud('expenses', payload.id, payload);
        await neonHttp.syncAction('ADD_EXPENSE', payload);
        break;

      case 'ADD_PURCHASE_ORDER':
        await client.query(
          `INSERT INTO "PurchaseOrder" (id, supplier_id, supplier_name, date, items, total_cost, paid_amount, discount_amount, payment_method, status, transport_cost, transport_paid_external)
             VALUES ($1, $2, $3, COALESCE($11::timestamp, NOW()), $4, $5, $6, COALESCE($12, 0), $7, $8, $9, $10)
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
               date=COALESCE($11::timestamp, "PurchaseOrder".date),
               discount_amount=COALESCE($12, "PurchaseOrder".discount_amount),
               updated_at=NOW()`,
          [payload.id, payload.supplierId, payload.supplierName, JSON.stringify(payload.items), payload.totalCost, payload.paidAmount, payload.paymentMethod, payload.status, payload.transportCost, payload.transportPaidExternal, payload.date, payload.discountAmount || 0]
        );
        if (payload.id) await cloudDb.syncToCloud('purchaseOrders', payload.id, payload);
        await neonHttp.syncAction('ADD_PURCHASE_ORDER', payload);
        break;

      case 'ADD_SUPPLIER_PAYMENT':
        await client.query(
          `INSERT INTO "SupplierPayment" (id, supplier_id, purchase_order_id, amount, date, note, payment_method, cheque_number, cheque_date, cheque_status)
              VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
          [payload.id, payload.supplierId, payload.purchaseOrderId, payload.amount, payload.note, payload.paymentMethod, payload.chequeNumber, payload.chequeDate, payload.chequeStatus]
        );
        if (payload.purchaseOrderId) {
          await client.query(`UPDATE "PurchaseOrder" SET paid_amount = paid_amount + $1 WHERE id=$2`, [payload.amount, payload.purchaseOrderId]);
        }
        if (payload.id) await cloudDb.syncToCloud('supplierPayments', payload.id, payload);
        await neonHttp.syncAction('ADD_SUPPLIER_PAYMENT', payload);
        break;

      case 'ADD_SUPPLIER':
        const s = payload;
        await client.query(
          `INSERT INTO "Supplier" (id, name, phone, hotline, worker_mobile, contact_person, category, email, address, bank_name, account_number, branch)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET
               name=$2, phone=$3, hotline=$4, worker_mobile=$5, contact_person=$6, category=$7, email=$8, address=$9, bank_name=$10, account_number=$11, branch=$12`,
          [s.id, s.name, s.phone, s.hotline, s.workerMobile, s.contactPerson, s.category, s.email, s.address, s.bankName, s.accountNumber, s.branch]
        );
        if (s.id) await cloudDb.syncToCloud('suppliers', s.id, s);
        await neonHttp.syncAction('ADD_SUPPLIER', s);
        break;

      case 'UNLINKED_RETURN':
        const { unlinkedQty, unlinkedItemDetails, unlinkedBillDetails } = payload;
        await client.query('BEGIN');

        if (unlinkedItemDetails.productId && !unlinkedItemDetails.productId.startsWith('CUSTOM') && !unlinkedItemDetails.productId.startsWith('SERVICE')) {
          await client.query(`UPDATE "Product" SET stock = stock + $1 WHERE id = $2`, [unlinkedQty, unlinkedItemDetails.productId]);
        }

        const unlinkedRefundVal = unlinkedItemDetails.price * unlinkedQty;
        const unlinkedRefundCost = unlinkedItemDetails.cost * unlinkedQty;
        const unlinkedRefundProfit = unlinkedItemDetails.profit * unlinkedQty; // Profit is usually per item here

        const unlinkedReturnId = 'RET-UNL-' + Date.now();
        await client.query(
          `INSERT INTO "ReturnRecord" (id, bill_id, product_id, quantity, refund_value, refund_cost, refund_profit, payment_type, customer_id, date, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
          [unlinkedReturnId, 'UNLINKED', unlinkedItemDetails.productId, unlinkedQty, unlinkedRefundVal, unlinkedRefundCost, unlinkedRefundProfit, unlinkedBillDetails.paymentType || 'CASH', unlinkedBillDetails.customerId, 'Unlinked return to stock']
        );
        await client.query('COMMIT');

        await cloudDb.syncToCloud('returns', unlinkedReturnId, { qty: unlinkedQty, itemDetails: unlinkedItemDetails, billDetails: unlinkedBillDetails, returnId: unlinkedReturnId, unlinked: true });
        await neonHttp.syncAction('UNLINKED_RETURN', { unlinkedQty, unlinkedItemDetails, unlinkedBillDetails, returnId: unlinkedReturnId });
        break;

      case 'RETURN_ITEM':
        const { billId, lineId, qty, itemDetails, billDetails } = payload;
        await client.query('BEGIN');
        const returnUpdate = await client.query(
          `UPDATE "BillItem"
             SET returned_quantity = returned_quantity + $1
           WHERE id = $2
             AND (returned_quantity + $1) <= quantity`,
          [qty, lineId]
        );
        if (!returnUpdate.rowCount) {
          throw new Error('Return quantity exceeds the remaining quantity for this item.');
        }
        if (itemDetails.productId && !itemDetails.productId.startsWith('CUSTOM') && !itemDetails.productId.startsWith('SERVICE')) {
          await client.query(`UPDATE "Product" SET stock = stock + $1 WHERE id = $2`, [qty, itemDetails.productId]);
        }
        const refundVal = itemDetails.price * qty;
        const refundCost = itemDetails.cost * qty;
        const refundProfit = (itemDetails.profit / Math.max(1, itemDetails.quantity)) * qty;
        const returnId = 'RET-' + Date.now();
        await client.query(
          `INSERT INTO "ReturnRecord" (id, bill_id, product_id, quantity, refund_value, refund_cost, refund_profit, payment_type, customer_id, date, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
          [returnId, billId, itemDetails.productId, qty, refundVal, refundCost, refundProfit, billDetails.paymentType || 'CASH', billDetails.customerId, 'Restored to stock']
        );
        await client.query('COMMIT');
        await cloudDb.syncToCloud('returns', returnId, { billId, lineId, qty, itemDetails, billDetails, returnId });
        await neonHttp.syncAction('RETURN_ITEM', { billId, lineId, qty, itemDetails, billDetails, returnId });
        break;

      case 'ADD_SUMMARY':
        const summ = payload;
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO "MonthlySummary" (id, month, year, total_sales, total_profit, total_expenses, net_profit, date_closed)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING`,
          [summ.id, summ.month, summ.year, summ.totalSales, summ.totalProfit, summ.totalExpenses, summ.netProfit, summ.dateClosed]
        );
        await client.query(`UPDATE "Bill" SET archived=TRUE, summary_id=$1 WHERE archived=FALSE`, [summ.id]);
        await client.query(`UPDATE "Expense" SET archived=TRUE, summary_id=$1 WHERE archived=FALSE`, [summ.id]);
        await client.query('COMMIT');
        await cloudDb.syncToCloud('summaries', summ.id, summ);
        await neonHttp.syncAction('ADD_SUMMARY', summ);
        break;
    }
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

SyncEngine.loadLocal();

export const db: DB = {
  setAuthToken: (t: string) => { },

  init: async () => {
    try {
      // Platform detection
      const isCap = isCapacitorRuntime();
      const electron = isDesktopRuntime();

      if (!electron && isCap && neonHttp.isUsable()) {
        console.log('[db] Native platform detected, checking REST connectivity...');
        const res = await neonHttp.query('SELECT 1');
        if (res && !res.error) {
          isOfflineMode = false;
          console.log('[db] REST connectivity confirmed.');
          return true;
        }
        throw new Error('REST check failed');
      }

      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      isOfflineMode = false;
      await SyncEngine.processQueue();
      await SyncEngine.syncAll();
      return true;
    } catch (e) {
      console.warn('[db] Connectivity check failed, starting in Offline Mode:', e);
      isOfflineMode = true;
      return true;
    }
  },

  isOffline: () => isOfflineMode,
  setOffline: (status: boolean) => {
    isOfflineMode = status;
    if (!status) {
      SyncEngine.processQueue().then(() => SyncEngine.syncAll());
    }
  },

  system: {
    syncPending: async () => SyncEngine.processQueue(),
    getBackupData: async () => ({
      meta: { date: new Date().toISOString(), version: '5.2' },
      data: dbCache
    }),
    restoreBackupData: async (json: any) => {
      if (json.data) {
        dbCache = json.data;
        SyncEngine.saveLocal();
      }
    }
  },

  getTableStats: async () => {
    return {
      product: dbCache.products.length,
      customer: dbCache.customers.length,
      bill: dbCache.bills.length,
      expense: dbCache.expenses.length
    };
  },

  executeRaw: async (q: string) => {
    if (isOfflineMode) throw new Error("Raw SQL unavailable in Offline Mode");
    const res = await pool.query(q);
    return res.rows.map(toCamel);
  },

  settings: {
    get: async (): Promise<BusinessSettings> => {
      if (!isOfflineMode) {
        pool.query(`SELECT * FROM "Settings" WHERE id = 'main'`).then(res => {
          if (res.rows[0]) {
            const s = mapSettings(toCamel(res.rows[0]));
            if (JSON.stringify(dbCache.settings) !== JSON.stringify(s)) {
              dbCache.settings = s;
              SyncEngine.saveLocal();
            }
          }
        }).catch(e => {
          isOfflineMode = true;
        });
      }
      return dbCache.settings || {
        id: 'main',
        businessName: 'WR Smile & Supplies',
        contactPhone: '0779336848, 0719336848',
        address: '411/7 Mullipothana 96, Kantale',
        currency: 'LKR',
        logoUrl: '',
        receiptNote: 'Multi-item returns accepted within 3 days. Please keep your receipt! Thank you!',
        returnDaysLimit: 3,
        returnConditions: 'Multi-item returns accepted with receipt within 3 days.'
      };
    },
    update: async (s: BusinessSettings) => {
      dbCache.settings = s;
      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        try {
          await executeCloudOperation('UPDATE_SETTINGS', s);
        } catch (e) { }
      }
    }
  },

  products: {
    getAll: async (): Promise<Product[]> => {
      return [...dbCache.products];
    },
    get: async (id: string): Promise<Product | undefined> => {
      return dbCache.products.find((p: Product) => p.id === id);
    },
    add: async (p: Partial<Product>) => {
      const id = p.id || generateId();
      const product = { ...p, id } as Product;
      dbCache.products = [...dbCache.products, product];
      SyncEngine.saveLocal();

      if (!isOfflineMode) {
        SyncEngine.addToQueue('ADD_PRODUCT', product);
        SyncEngine.processQueue();
      } else {
        SyncEngine.addToQueue('ADD_PRODUCT', product);
      }
      return id;
    },
    update: async (p: Product) => {
      const idx = dbCache.products.findIndex((x: Product) => x.id === p.id);
      if (idx > -1) {
        const newProducts = [...dbCache.products];
        newProducts[idx] = p;
        dbCache.products = newProducts;
        SyncEngine.saveLocal();
        if (!isOfflineMode) {
          SyncEngine.addToQueue('ADD_PRODUCT', p);
          SyncEngine.processQueue();
        } else {
          SyncEngine.addToQueue('ADD_PRODUCT', p);
        }
      }
    },
    delete: async (id: string) => {
      dbCache.products = dbCache.products.filter((p: Product) => p.id !== id);
      SyncEngine.saveLocal();
      if (!isOfflineMode) try { await pool.query(`DELETE FROM "Product" WHERE id=$1`, [id]); } catch (e) { }
    }
  },

  productRequests: {
    getAll: async () => [...dbCache.productRequests],
    getOpen: async () => dbCache.productRequests.filter((r: ProductRequest) => r.status === 'OPEN'),
    add: async (request: Partial<ProductRequest>) => {
      const now = new Date().toISOString();
      const req: ProductRequest = {
        id: request.id || generateId(),
        itemName: String(request.itemName || '').trim(),
        quantity: Number(request.quantity || 1),
        customerId: request.customerId || null,
        customerName: request.customerName || '',
        customerPhone: request.customerPhone || '',
        note: request.note || '',
        status: request.status || 'OPEN',
        createdAt: request.createdAt || now,
        updatedAt: now,
        orderedPurchaseOrderId: request.orderedPurchaseOrderId
      };
      if (!req.itemName) throw new Error('Requested item name is required.');
      dbCache.productRequests = [req, ...dbCache.productRequests];
      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        SyncEngine.addToQueue('ADD_PRODUCT_REQUEST', req);
        SyncEngine.processQueue();
      } else {
        SyncEngine.addToQueue('ADD_PRODUCT_REQUEST', req);
      }
      return req.id;
    },
    update: async (request: ProductRequest) => {
      const idx = dbCache.productRequests.findIndex((r: ProductRequest) => r.id === request.id);
      const updated = { ...request, updatedAt: new Date().toISOString() };
      if (idx > -1) {
        const next = [...dbCache.productRequests];
        next[idx] = updated;
        dbCache.productRequests = next;
      } else {
        dbCache.productRequests = [updated, ...dbCache.productRequests];
      }
      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        SyncEngine.addToQueue('ADD_PRODUCT_REQUEST', updated);
        SyncEngine.processQueue();
      } else {
        SyncEngine.addToQueue('ADD_PRODUCT_REQUEST', updated);
      }
    },
    markOrdered: async (ids: string[], purchaseOrderId?: string) => {
      const idSet = new Set(ids);
      const changed: ProductRequest[] = [];
      dbCache.productRequests = dbCache.productRequests.map((req: ProductRequest) => {
        if (!idSet.has(req.id)) return req;
        const updated = { ...req, status: 'ORDERED' as const, orderedPurchaseOrderId: purchaseOrderId, updatedAt: new Date().toISOString() };
        changed.push(updated);
        return updated;
      });
      SyncEngine.saveLocal();
      changed.forEach(req => SyncEngine.addToQueue('ADD_PRODUCT_REQUEST', req));
      if (!isOfflineMode) SyncEngine.processQueue();
    },
    delete: async (id: string) => {
      dbCache.productRequests = dbCache.productRequests.filter((r: ProductRequest) => r.id !== id);
      SyncEngine.saveLocal();
      if (!isOfflineMode) try { await pool.query(`DELETE FROM "ProductRequest" WHERE id=$1`, [id]); } catch (e) { }
    }
  },

  customers: {
    getAll: async () => {
      return [...dbCache.customers];
    },
    get: async (id: string): Promise<Customer | undefined> => {
      return dbCache.customers.find((c: Customer) => c.id === id);
    },
    add: async (c: Partial<Customer>) => {
      const id = c.id || generateId();
      const customer = { ...c, id, totalLoan: 0, totalPaid: 0, balanceDue: 0 } as Customer;
      dbCache.customers.push(customer);
      SyncEngine.saveLocal();

      if (!isOfflineMode) {
        try { await executeCloudOperation('ADD_CUSTOMER', customer); }
        catch (e) { isOfflineMode = true; SyncEngine.addToQueue('ADD_CUSTOMER', customer); }
      } else {
        SyncEngine.addToQueue('ADD_CUSTOMER', customer);
      }
      return id;
    },
    create: async (c: Partial<Customer>) => {
      const id = generateId();
      const newCustomer: Customer = {
        id,
        name: c.name || '',
        phone: c.phone || '',
        nic: c.nic,
        address: c.address,
        totalLoan: 0,
        totalPaid: 0,
        balanceDue: 0,
        language: c.language || 'en'
      };
      dbCache.customers = [newCustomer, ...dbCache.customers];
      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        try {
          await pool.query(`INSERT INTO "Customer" (id, name, phone, nic, address, total_loan, total_paid, balance, language) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, newCustomer.name, newCustomer.phone, newCustomer.nic, newCustomer.address, 0, 0, 0, newCustomer.language]);
        } catch (e) { }
      }
      return id;
    },
    update: async (c: Customer) => {
      const idx = dbCache.customers.findIndex((x: Customer) => x.id === c.id);
      if (idx > -1) {
        const newCustomers = [...dbCache.customers];
        newCustomers[idx] = c;
        dbCache.customers = newCustomers;
        SyncEngine.saveLocal();
        if (!isOfflineMode) {
          SyncEngine.addToQueue('ADD_CUSTOMER_FULL', c);
          SyncEngine.processQueue();
        } else {
          SyncEngine.addToQueue('ADD_CUSTOMER_FULL', c);
        }
      }
    },
    delete: async (id: string) => {
      dbCache.customers = dbCache.customers.filter((c: Customer) => c.id !== id);
      SyncEngine.saveLocal();
      if (!isOfflineMode) try { await pool.query(`DELETE FROM "Customer" WHERE id=$1`, [id]); } catch (e) { }
    },
    recalculateBalance: async (id: string) => {
      if (isOfflineMode) throw new Error("Recalculation requires online mode to ensure full history.");
      const client = await pool.connect();
      try {
        const statsRes = await client.query(`
          SELECT 
            (SELECT SUM(total) FROM "Bill" WHERE customer_id = $1 AND archived = FALSE) as total_billed,
            (SELECT SUM(cash_received) FROM "Bill" WHERE customer_id = $1 AND archived = FALSE) as total_downpayment,
            (SELECT SUM(amount) FROM "Payment" WHERE customer_id = $1) as total_paid,
            (SELECT SUM(refund_value) FROM "ReturnRecord" WHERE customer_id = $1 AND payment_type = 'CREDIT') as total_returned
        `, [id]);

        const stats = statsRes.rows[0];
        const billTotal = toNum(stats.total_billed);
        const downPaymentTotal = toNum(stats.total_downpayment);
        const paymentTotal = toNum(stats.total_paid);
        const returnTotal = toNum(stats.total_returned);

        const effectiveDebt = Math.max(0, billTotal - downPaymentTotal);
        const effectivePayments = paymentTotal + returnTotal;

        const newBalance = Math.max(0, effectiveDebt - effectivePayments);
        const newTotalPaid = paymentTotal + downPaymentTotal;
        const newTotalLoan = effectiveDebt;

        await client.query(`UPDATE "Customer" SET balance = $1, total_paid = $2, total_loan = $3 WHERE id = $4`,
          [newBalance, newTotalPaid, newTotalLoan, id]);

        const c = dbCache.customers.find((x: Customer) => x.id === id);
        if (c) {
          c.balanceDue = newBalance;
          c.totalPaid = newTotalPaid;
          c.totalLoan = newTotalLoan;
          SyncEngine.saveLocal();

          if (!isOfflineMode) {
            SyncEngine.addToQueue('ADD_CUSTOMER_FULL', c);
            SyncEngine.processQueue();
          } else {
            SyncEngine.addToQueue('ADD_CUSTOMER_FULL', c);
          }
        }
        return { balance: newBalance, totalPaid: newTotalPaid };
      } finally {
        client.release();
      }
    }
  },

  bills: {
    getAll: async (archived = false): Promise<Bill[]> => {
      if (!isOfflineMode) {
        pool.query(`SELECT * FROM "Bill" WHERE archived = $1 ORDER BY created_at DESC LIMIT 500`, [archived]).then(async res => {
          const bills = res.rows.map(r => mapBill(toCamel(r)));
          if (bills.length > 0) {
            const billIds = bills.map(b => b.id);
            const itemsRes = await pool.query(
              `SELECT * FROM "BillItem" WHERE bill_id = ANY($1::text[])`,
              [billIds]
            );
            const allItems = itemsRes.rows.map(r => mapBillItem(toCamel(r)));
            bills.forEach(b => {
              b.items = allItems.filter(i => i.billId === b.id);
            });
          }
          dbCache.bills = bills;
          SyncEngine.saveLocal();
        }).catch(e => {
          isOfflineMode = true;
        });
      }
      return dbCache.bills;
    },
    getAllForCustomer: async (cid: string) => {
      return [...dbCache.bills.filter((b: Bill) => b.customerId === cid)];
    },
    getByInvoiceNumber: async (inv: string) => {
      const local = dbCache.bills.find((b: Bill) => b.invoiceNumber.toUpperCase() === inv.toUpperCase());
      if (local) return local;
      if (!isOfflineMode) {
        try {
          const res = await pool.query(`SELECT * FROM "Bill" WHERE UPPER(invoice_number) = $1`, [inv.toUpperCase()]);
          if (res.rows[0]) {
            const b = mapBill(toCamel(res.rows[0]));
            const itemRes = await pool.query(`SELECT * FROM "BillItem" WHERE bill_id = $1`, [b.id]);
            b.items = itemRes.rows.map((i: any) => mapBillItem(toCamel(i)));
            return b;
          }
        } catch (e) { }
      }
      return null;
    },
    create: async (bill: Bill) => {
      dbCache.bills = [bill, ...dbCache.bills];

      // Reduce stock locally right away so Offline Mode stays accurate.
      for (const item of bill.items) {
        if (isInventoryTrackedProduct(item.productId)) {
          applyLocalStockDelta(item.productId, -toNum(item.quantity));
        }
      }

      // Update customer balance in local cache immediately
      if (bill.customerId) {
        const balanceChange = bill.total - (bill.cashReceived || 0);
        const cashReceived = bill.cashReceived || 0;

        const customerIndex = dbCache.customers.findIndex((c: Customer) => c.id === bill.customerId);
        if (customerIndex > -1) {
          const customer = dbCache.customers[customerIndex];
          const updatedCustomer = {
            ...customer,
            balanceDue: (customer.balanceDue || 0) + balanceChange,
            totalLoan: (customer.totalLoan || 0) + balanceChange,
            totalPaid: (customer.totalPaid || 0) + cashReceived
          };
          const newCustomers = [...dbCache.customers];
          newCustomers[customerIndex] = updatedCustomer;
          dbCache.customers = newCustomers;
        }
      }

      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        SyncEngine.addToQueue('ADD_BILL', { bill });
        SyncEngine.processQueue();
      } else {
        SyncEngine.addToQueue('ADD_BILL', { bill });
      }
      return bill.id;
    },
    returnItem: async (billId: string, lineId: string, qty: number) => {
      const bill = dbCache.bills.find((b: Bill) => b.id === billId);
      let returnPayload: any = null;
      if (bill) {
        const item = bill.items.find((i: BillItem) => i.lineId === lineId || i.productId === lineId);
        if (item) {
          const remainingQty = Math.max(0, toNum(item.quantity) - toNum(item.returnedQty));
          if (qty <= 0 || qty > remainingQty) {
            throw new Error(`Return quantity exceeds remaining quantity for ${item.name}. Remaining: ${remainingQty}`);
          }
          item.returnedQty = (item.returnedQty || 0) + qty;
          returnPayload = {
            billId,
            lineId: item.lineId || lineId,
            qty,
            itemDetails: {
              productId: item.productId,
              price: item.price,
              cost: item.cost,
              profit: item.profit,
              quantity: item.quantity
            },
            billDetails: {
              paymentType: bill.paymentType,
              customerId: bill.customerId
            }
          };

          if (isInventoryTrackedProduct(item.productId)) {
            applyLocalStockDelta(item.productId, toNum(qty));
          }
        }
      }
      if (!returnPayload) {
        throw new Error('Could not find the selected bill item for return.');
      }
      SyncEngine.saveLocal();
      if (returnPayload) {
        if (!isOfflineMode) {
          try { await executeCloudOperation('RETURN_ITEM', returnPayload); }
          catch (e) { isOfflineMode = true; SyncEngine.addToQueue('RETURN_ITEM', returnPayload); }
        } else {
          SyncEngine.addToQueue('RETURN_ITEM', returnPayload);
        }
      }
    },
    returnUnlinkedItem: async (productId: string, qty: number, price: number, cost: number, paymentType: string, customerId?: string) => {
      if (isInventoryTrackedProduct(productId)) {
        applyLocalStockDelta(productId, toNum(qty));
      }

      const returnPayload = {
        unlinkedQty: qty,
        unlinkedItemDetails: {
          productId,
          price,
          cost,
          profit: price - cost
        },
        unlinkedBillDetails: {
          paymentType,
          customerId: customerId || null
        }
      };

      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        try { await executeCloudOperation('UNLINKED_RETURN', returnPayload); }
        catch (e) { isOfflineMode = true; SyncEngine.addToQueue('UNLINKED_RETURN', returnPayload); }
      } else {
        SyncEngine.addToQueue('UNLINKED_RETURN', returnPayload);
      }
    }
  },

  expenses: {
    getAll: async () => [...dbCache.expenses],
    add: async (e: Partial<Expense>) => {
      const id = generateId();
      const expense = { ...e, id, date: new Date().toISOString() } as Expense;
      dbCache.expenses = [expense, ...dbCache.expenses];
      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        SyncEngine.addToQueue('ADD_EXPENSE', expense);
        SyncEngine.processQueue();
      } else {
        SyncEngine.addToQueue('ADD_EXPENSE', expense);
      }
      return id;
    },
    update: async (e: Expense) => {
      const idx = dbCache.expenses.findIndex((x: Expense) => x.id === e.id);
      if (idx > -1) {
        const d = [...dbCache.expenses];
        d[idx] = e;
        dbCache.expenses = d;
        SyncEngine.saveLocal();
      }
    },
    delete: async (id: string) => {
      dbCache.expenses = dbCache.expenses.filter((x: Expense) => x.id !== id);
      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        try { await pool.query(`DELETE FROM "Expense" WHERE id=$1`, [id]); } catch (e) { }
      }
    }
  },

  reminders: {
    getOverdueBills: async (): Promise<any[]> => {
      if (!isOfflineMode) {
        try {
          const res = await pool.query(`
            SELECT b.*, c.name as customer_name, c.phone as whatsapp, c.language
            FROM "Bill" b
            JOIN "Customer" c ON b.customer_id = c.id
            WHERE b.total - b.cash_received > 0.1
            AND b.due_date IS NOT NULL
            AND b.due_date < NOW()::date::text
            AND b.archived = FALSE
          `);
          return res.rows.map(toCamel);
        } catch (e) { }
      }
      const today = new Date().toISOString().split('T')[0];
      return dbCache.bills.filter((b: Bill) =>
        b.customerId &&
        (b.total - (b.cashReceived || 0) > 0.1) &&
        b.dueDate &&
        b.dueDate < today &&
        !b.archived
      ).map((b: Bill) => {
        const c = dbCache.customers.find((cust: Customer) => cust.id === b.customerId);
        return {
          ...b,
          whatsapp: c?.phone,
          customerName: c?.name,
          language: c?.language || 'en'
        };
      });
    }
  },

  suppliers: {
    getAll: async () => [...dbCache.suppliers],
    add: async (s: Partial<Supplier>) => {
      const id = generateId();
      const sup = { ...s, id } as Supplier;
      dbCache.suppliers = [...dbCache.suppliers, sup];
      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        SyncEngine.addToQueue('ADD_SUPPLIER', sup);
        SyncEngine.processQueue();
      } else {
        SyncEngine.addToQueue('ADD_SUPPLIER', sup);
      }
      return id;
    },
    update: async (s: Supplier) => {
      const idx = dbCache.suppliers.findIndex((x: Supplier) => x.id === s.id);
      if (idx > -1) {
        const newSuppliers = [...dbCache.suppliers];
        newSuppliers[idx] = s;
        dbCache.suppliers = newSuppliers;
        SyncEngine.saveLocal();
        if (!isOfflineMode) {
          SyncEngine.addToQueue('ADD_SUPPLIER', s);
          SyncEngine.processQueue();
        } else {
          SyncEngine.addToQueue('ADD_SUPPLIER', s);
        }
      }
    },
    delete: async (id: string) => {
      dbCache.suppliers = dbCache.suppliers.filter((x: Supplier) => x.id !== id);
      SyncEngine.saveLocal();
      if (!isOfflineMode) try { await pool.query(`DELETE FROM "Supplier" WHERE id=$1`, [id]); } catch (e) { }
    }
  },

  purchaseOrders: {
    getAll: async () => [...dbCache.purchaseOrders],
    add: async (po: Partial<PurchaseOrder>) => {
      const id = po.id || generateId();
      const newPo = { ...po, id, date: new Date().toISOString() } as PurchaseOrder;
      dbCache.purchaseOrders = [newPo, ...dbCache.purchaseOrders];
      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        SyncEngine.addToQueue('ADD_PURCHASE_ORDER', newPo);
        SyncEngine.processQueue();
      } else {
        SyncEngine.addToQueue('ADD_PURCHASE_ORDER', newPo);
      }
      return id;
    },
    update: async (po: PurchaseOrder) => {
      const idx = dbCache.purchaseOrders.findIndex((x: PurchaseOrder) => x.id === po.id);
      if (idx > -1) {
        const d = [...dbCache.purchaseOrders];
        d[idx] = po;
        dbCache.purchaseOrders = d;
        SyncEngine.saveLocal();
        if (!isOfflineMode) {
          SyncEngine.addToQueue('ADD_PURCHASE_ORDER', po);
          SyncEngine.processQueue();
        } else {
          SyncEngine.addToQueue('ADD_PURCHASE_ORDER', po);
        }
      }
    },
    delete: async (id: string) => {
      dbCache.purchaseOrders = dbCache.purchaseOrders.filter((x: PurchaseOrder) => x.id !== id);
      SyncEngine.saveLocal();
      if (!isOfflineMode) try { await pool.query(`DELETE FROM "PurchaseOrder" WHERE id=$1`, [id]); } catch (e) { }
    }
  },

  payments: {
    getAll: async () => [...dbCache.payments],
    getByCustomerId: async (cid: string) => dbCache.payments.filter((p: Payment) => p.customerId === cid),
    add: async (p: Partial<Payment>) => {
      const id = generateId();
      const payment = { ...p, id, date: new Date().toISOString() } as Payment;
      dbCache.payments = [payment, ...dbCache.payments];
      const c = dbCache.customers.find((cust: Customer) => cust.id === payment.customerId);
      if (c) {
        const newC = { ...c };
        newC.balanceDue = Math.round(Math.max(0, newC.balanceDue - payment.amount));
        newC.totalPaid = Math.round(newC.totalPaid + payment.amount);
        const cIdx = dbCache.customers.findIndex((x: Customer) => x.id === c.id);
        const carts = [...dbCache.customers];
        carts[cIdx] = newC;
        dbCache.customers = carts;
        if (!isOfflineMode) {
          SyncEngine.addToQueue('ADD_CUSTOMER_FULL', newC);
        } else {
          SyncEngine.addToQueue('ADD_CUSTOMER_FULL', newC);
        }
      }
      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        SyncEngine.addToQueue('ADD_PAYMENT', payment);
        SyncEngine.processQueue();
      } else {
        SyncEngine.addToQueue('ADD_PAYMENT', payment);
      }
      return id;
    },
    update: async (id: string, cid: string, oldAmount: number, newAmount: number, note: string) => {
      const idx = dbCache.payments.findIndex((x: Payment) => x.id === id);
      if (idx > -1) {
        const pArr = [...dbCache.payments];
        pArr[idx] = { ...pArr[idx], amount: newAmount, note };
        dbCache.payments = pArr;
        const c = dbCache.customers.find((cust: Customer) => cust.id === cid);
        if (c) {
          const newC = { ...c };
          newC.balanceDue = Math.round(Math.max(0, newC.balanceDue + oldAmount - newAmount));
          newC.totalPaid = Math.round(newC.totalPaid - oldAmount + newAmount);
          const cIdx = dbCache.customers.findIndex((x: Customer) => x.id === c.id);
          const carts = [...dbCache.customers];
          carts[cIdx] = newC;
          dbCache.customers = carts;
          if (!isOfflineMode) {
            SyncEngine.addToQueue('ADD_CUSTOMER_FULL', newC);
          } else {
            SyncEngine.addToQueue('ADD_CUSTOMER_FULL', newC);
          }
        }
        SyncEngine.saveLocal();
        if (!isOfflineMode) {
          SyncEngine.addToQueue('ADD_PAYMENT', dbCache.payments[idx]);
          SyncEngine.processQueue();
        } else {
          SyncEngine.addToQueue('ADD_PAYMENT', dbCache.payments[idx]);
        }
      }
    },
    delete: async (id: string, cid: string, amount: number) => {
      dbCache.payments = dbCache.payments.filter((x: Payment) => x.id !== id);
      const c = dbCache.customers.find((cust: Customer) => cust.id === cid);
      if (c) {
        const newC = { ...c };
        newC.balanceDue = Math.round(Math.max(0, newC.balanceDue + amount));
        newC.totalPaid = Math.round(newC.totalPaid - amount);
        const cIdx = dbCache.customers.findIndex((x: Customer) => x.id === c.id);
        const carts = [...dbCache.customers];
        carts[cIdx] = newC;
        dbCache.customers = carts;
        if (!isOfflineMode) {
          SyncEngine.addToQueue('ADD_CUSTOMER_FULL', newC);
        } else {
          SyncEngine.addToQueue('ADD_CUSTOMER_FULL', newC);
        }
      }
      SyncEngine.saveLocal();
      if (!isOfflineMode) try { await pool.query(`DELETE FROM "Payment" WHERE id=$1`, [id]); } catch (e) { }
    }
  },

  supplierPayments: {
    getAll: async () => [...dbCache.supplierPayments],
    getBySupplierId: async (sid: string) => dbCache.supplierPayments.filter((p: SupplierPayment) => p.supplierId === sid),
    add: async (p: Partial<SupplierPayment>) => {
      const id = generateId();
      const payment = { ...p, id, date: new Date().toISOString() } as SupplierPayment;
      dbCache.supplierPayments = [payment, ...dbCache.supplierPayments];
      if (payment.purchaseOrderId) {
        const po = dbCache.purchaseOrders.find((x: PurchaseOrder) => x.id === payment.purchaseOrderId);
        if (po) {
          const newPo = { ...po, paidAmount: (po.paidAmount || 0) + payment.amount };
          const poIdx = dbCache.purchaseOrders.findIndex((x: PurchaseOrder) => x.id === po.id);
          const pos = [...dbCache.purchaseOrders];
          pos[poIdx] = newPo;
          dbCache.purchaseOrders = pos;
        }
      }
      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        SyncEngine.addToQueue('ADD_SUPPLIER_PAYMENT', payment);
        SyncEngine.processQueue();
      } else {
        SyncEngine.addToQueue('ADD_SUPPLIER_PAYMENT', payment);
      }
      return id;
    },
    update: async (id: string, oldAmount: number, newAmount: number, note: string, method: string, poId?: string) => {
      const idx = dbCache.supplierPayments.findIndex((x: SupplierPayment) => x.id === id);
      if (idx > -1) {
        const arr = [...dbCache.supplierPayments];
        arr[idx] = { ...arr[idx], amount: newAmount, note, paymentMethod: method as any, purchaseOrderId: poId };
        dbCache.supplierPayments = arr;
        if (poId) {
          const po = dbCache.purchaseOrders.find((x: PurchaseOrder) => x.id === poId);
          if (po) {
            const newPo = { ...po, paidAmount: (po.paidAmount || 0) - oldAmount + newAmount };
            const poIdx = dbCache.purchaseOrders.findIndex((x: PurchaseOrder) => x.id === po.id);
            const pos = [...dbCache.purchaseOrders];
            pos[poIdx] = newPo;
            dbCache.purchaseOrders = pos;
          }
        }
        SyncEngine.saveLocal();
        if (!isOfflineMode) {
          SyncEngine.addToQueue('ADD_SUPPLIER_PAYMENT', dbCache.supplierPayments[idx]);
          SyncEngine.processQueue();
        } else {
          SyncEngine.addToQueue('ADD_SUPPLIER_PAYMENT', dbCache.supplierPayments[idx]);
        }
      }
    },
    delete: async (id: string) => {
      const pay = dbCache.supplierPayments.find((x: SupplierPayment) => x.id === id);
      if (pay && pay.purchaseOrderId) {
        const po = dbCache.purchaseOrders.find((x: PurchaseOrder) => x.id === pay.purchaseOrderId);
        if (po) {
          const newPo = { ...po, paidAmount: po.paidAmount - pay.amount };
          const poIdx = dbCache.purchaseOrders.findIndex((x: PurchaseOrder) => x.id === po.id);
          const pos = [...dbCache.purchaseOrders];
          pos[poIdx] = newPo;
          dbCache.purchaseOrders = pos;
        }
      }
      dbCache.supplierPayments = dbCache.supplierPayments.filter((x: SupplierPayment) => x.id !== id);
      SyncEngine.saveLocal();
      if (!isOfflineMode) try { await pool.query(`DELETE FROM "SupplierPayment" WHERE id=$1`, [id]); } catch (e) { }
    },
    updateStatus: async (id: string, status: string) => {
      const idx = dbCache.supplierPayments.findIndex((x: SupplierPayment) => x.id === id);
      if (idx > -1) {
        const arr = [...dbCache.supplierPayments];
        arr[idx] = { ...arr[idx], chequeStatus: status as any };
        dbCache.supplierPayments = arr;
        SyncEngine.saveLocal();
        if (!isOfflineMode) {
          SyncEngine.addToQueue('ADD_SUPPLIER_PAYMENT', dbCache.supplierPayments[idx]);
          SyncEngine.processQueue();
        } else {
          SyncEngine.addToQueue('ADD_SUPPLIER_PAYMENT', dbCache.supplierPayments[idx]);
        }
      }
    }
  },

  returns: {
    getAll: async () => [...dbCache.returns],
  },

  summaries: {
    getAll: async () => [...dbCache.summaries],
    add: async (s: MonthlySummary) => {
      dbCache.summaries = [s, ...dbCache.summaries];
      SyncEngine.saveLocal();
      if (!isOfflineMode) {
        SyncEngine.addToQueue('ADD_SUMMARY', s);
        SyncEngine.processQueue();
      } else {
        SyncEngine.addToQueue('ADD_SUMMARY', s);
      }
    },
    getArchivedBills: async (id: string): Promise<Bill[]> => [],
    getArchivedExpenses: async (id: string): Promise<Expense[]> => []
  }
};
