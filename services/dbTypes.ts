/**
 * Database Row Type Definitions
 * Strictly typed interfaces for database operations
 */

// Base database row interface
export interface DbRow {
  id: string | number;
  created_at?: string | Date;
  updated_at?: string | Date;
}

// Product table row
export interface ProductRow extends DbRow {
  name: string;
  category?: string;
  barcode?: string;
  sku?: string;
  product_code?: string;
  cost?: number | string;
  price?: number | string;
  stock?: number | string;
  transport_cost?: number | string;
  margin_type?: string;
  margin_value?: number | string;
  warranty_years?: number | string;
  warranty_unit?: string;
  warranty_cost?: number | string;
  warranty_price?: number | string;
  has_warranty?: boolean;
  description?: string;
}

// Customer table row
export interface CustomerRow extends DbRow {
  name: string;
  phone: string;
  nic?: string;
  address?: string;
  total_loan?: number | string;
  total_paid?: number | string;
  balance?: number | string;
  language?: string;
  tags?: string[];
}

// Bill table row
export interface BillRow extends DbRow {
  invoice_number: string;
  date: string | Date;
  customer_id?: string | null;
  customer_name?: string;
  subtotal?: number | string;
  total_cost?: number | string;
  total_profit?: number | string;
  discount?: number | string;
  total?: number | string;
  cash_received?: number | string;
  change_returned?: number | string;
  payment_type?: string;
  due_date?: string | null;
  archived?: boolean;
  summary_id?: string | null;
  items?: unknown[]; // JSON array of bill items
}


// Bill item table row
export interface BillItemRow extends DbRow {
  bill_id?: string;
  product_id: string;
  name: string;
  sku?: string;
  quantity?: number | string;
  returned_quantity?: number | string;
  cost?: number | string;
  price?: number | string;
  profit?: number | string;
  warranty?: boolean;
  warranty_years?: number | string;
  warranty_unit?: string;
  warranty_price?: number | string;
  warranty_cost?: number | string;
  discount_type?: string;
  discount_value?: number | string;
}

// Expense table row
export interface ExpenseRow extends DbRow {
  category: string;
  amount: number | string;
  date: string | Date;
  note?: string;
  archived?: boolean;
  summary_id?: string;
}

// Supplier table row
export interface SupplierRow extends DbRow {
  name: string;
  phone?: string;
  hotline?: string;
  worker_mobile?: string;
  contact_person?: string;
  category?: string;
  email?: string;
  address?: string;
  bank_name?: string;
  account_number?: string;
  branch?: string;
}

// Payment table row
export interface PaymentRow extends DbRow {
  customer_id: string;
  amount: number | string;
  date: string | Date;
  note?: string;
}

// Supplier payment table row
export interface SupplierPaymentRow extends DbRow {
  supplier_id: string;
  purchase_order_id?: string;
  amount: number | string;
  date: string | Date;
  note?: string;
  payment_method?: string;
  cheque_number?: string;
  cheque_date?: string;
  cheque_status?: string;
}

// Purchase order table row
export interface PurchaseOrderRow extends DbRow {
  supplier_id: string;
  supplier_name?: string;
  date: string | Date;
  items?: string; // JSON string
  total_cost?: number | string;
  paid_amount?: number | string;
  discount_amount?: number | string;
  payment_method?: string;
  status?: string;
  transport_cost?: number | string;
  transport_paid_external?: boolean;
}

// Return record table row
export interface ReturnRecordRow extends DbRow {
  bill_id: string;
  product_id: string;
  product_name?: string;
  quantity?: number | string;
  refund_value?: number | string;
  refund_cost?: number | string;
  refund_profit?: number | string;
  payment_type?: string;
  customer_id?: string | null;
  customer_name?: string;
  date: string | Date;
  note?: string;
}

// Monthly summary table row
export interface MonthlySummaryRow extends DbRow {
  month: number;
  year: number;
  total_sales?: number | string;
  total_profit?: number | string;
  total_expenses?: number | string;
  net_profit?: number | string;
  date_closed: string | Date;
}

// Settings table row
export interface SettingsRow extends DbRow {
  business_name?: string;
  currency?: string;
  return_days_limit?: number;
  return_conditions?: string;
  address?: string;
  contact_phone?: string;
  logo_url?: string;
  receipt_note?: string;
  sms_gateway_url?: string;
  sms_gateway_token?: string;
  sms_gateway_global_token?: string;
}

// WhatsApp message table row
export interface WhatsAppMessageRow extends DbRow {
  from_number: string;
  to_number?: string;
  text: string;
  type: 'incoming' | 'outgoing';
  method: 'cloud' | 'qr';
  timestamp: string | Date;
}

// Type guard functions
export function isValidRow(row: unknown): row is DbRow {
  return typeof row === 'object' && 
         row !== null && 
         'id' in row;
}

export function isProductRow(row: unknown): row is ProductRow {
  return isValidRow(row) && 
         'name' in row;
}

export function isCustomerRow(row: unknown): row is CustomerRow {
  return isValidRow(row) && 
         'name' in row && 
         'phone' in row;
}

// Safe type conversion utilities
export function safeNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

export function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function safeBoolean(value: unknown): boolean {
  return Boolean(value);
}

export function safeDate(value: unknown): string {
  if (value === null || value === undefined) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
  return new Date().toISOString();
}

// Database query result wrapper
export interface QueryResult<T> {
  success: boolean;
  data?: T[];
  error?: string;
  rowCount?: number;
}

// Safe query execution wrapper type
export type SafeQueryExecutor = <T>(
  query: string,
  params?: unknown[]
) => Promise<QueryResult<T>>;
