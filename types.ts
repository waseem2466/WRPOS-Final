

export enum MarginType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED'
}

export type WarrantyUnit = 'MONTHS' | 'YEARS';

export interface Product {
  id: string;
  name: string;
  category: string;
  barcode?: string;
  sku?: string;
  cost: number;
  transportCost: number;
  totalCost: number;
  marginType: MarginType;
  marginValue: number;
  price: number;
  stock: number;
  warrantyYears: number;
  warrantyUnit: WarrantyUnit;
  warrantyCost: number;
  warrantyPrice: number;
  hasWarranty?: boolean;
  description?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  nic?: string;
  address?: string;
  totalLoan: number;
  totalPaid: number;
  balanceDue: number;
  language?: 'en' | 'ta' | 'si';
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  hotline?: string;
  workerMobile?: string;
  contactPerson?: string;
  category: string;
  email?: string;
  address?: string;
  bankName?: string;
  accountNumber?: string;
  branch?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  purchaseOrderId?: string;
  amount: number;
  date: string;
  note: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  chequeNumber?: string;
  chequeDate?: string;
  chequeStatus?: 'PENDING' | 'PASSED' | 'BOUNCED';
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  note: string;
  archived?: boolean;
  summaryId?: string;
}

export interface MonthlySummary {
  id: string;
  month: number;
  year: number;
  totalSales: number;
  totalProfit: number;
  totalExpenses: number;
  netProfit: number;
  dateClosed: string;
}

export interface BillItem {
  lineId?: string;
  billId?: string;
  productId: string;
  name: string;
  sku?: string;
  quantity: number;
  returnedQty?: number;
  cost: number;
  price: number;
  originalPrice?: number;
  profit: number;
  warranty: boolean;
  warrantyYears?: number;
  warrantyUnit?: WarrantyUnit;
  warrantyPrice?: number;
  warrantyCost?: number;
  discountType?: 'FIXED' | 'PERCENTAGE';
  discountValue?: number;
}

export interface Bill {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId: string | null;
  customerName: string;
  items: BillItem[];
  subtotal: number;
  totalCost: number;
  totalProfit: number;
  discount: number;
  total: number;
  cashReceived?: number;
  changeReturned?: number;
  paymentType: 'CASH' | 'LOAN';
  dueDate?: string;
  archived?: boolean;
  summaryId?: string;
}

export interface ReturnRecord {
  id: string;
  billId: string;
  productId: string;
  productName?: string;
  quantity: number;
  refundValue: number;
  refundCost: number;
  refundProfit: number;
  paymentType: string;
  customerId: string | null;
  customerName?: string;
  date: string;
  note: string;
}

export interface BusinessSettings {
  id: string;
  businessName: string;
  contactPhone: string;
  address: string;
  logoUrl: string;
  currency: string;
  receiptNote: string;
  returnDaysLimit: number;
  returnConditions: string;
  waAccessToken?: string;
  waPhoneNumberId?: string;
  smsGatewayUrl?: string;
  smsGatewayToken?: string;
  smsGatewayGlobalToken?: string;
}

export interface AIConfig {
  provider: 'gemini' | 'deepseek' | 'ollama-cloud' | 'local-phi';
  model?: string;
}

export type PurchaseOrderStatus = 'PENDING' | 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  productId?: string;
  name: string;
  quantity: number;
  receivedQuantity?: number;
  shortageQuantity?: number;
  damagedQuantity?: number;
  unitCost: number;
  discountPercentage?: number;
  sellingPrice?: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: PurchaseOrderItem[];
  totalCost: number;
  paidAmount: number;
  discountAmount?: number;
  paymentMethod?: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER';
  status: PurchaseOrderStatus;
  transportCost?: number;
  transportPaidExternal?: boolean;
}

/**
 * Represents a payment transaction made by a customer to settle their balance.
 */
export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  date: string;
  note: string;
}