

export enum MarginType {
  PERCENTAGE = 'PERCENTAGE',
  MANUAL = 'MANUAL'
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
  imageUrl?: string;
}

export type ProductRequestStatus = 'OPEN' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';

export interface ProductRequest {
  id: string;
  itemName: string;
  quantity: number;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  status: ProductRequestStatus;
  createdAt: string;
  updatedAt?: string;
  orderedPurchaseOrderId?: string;
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
  serialNumber?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
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

export type WarrantyClaimStatus = 'RECEIVED' | 'SENT_TO_SUPPLIER' | 'REPAIRING' | 'READY' | 'REJECTED' | 'HANDED_OVER';
export type WarrantyChargeType = 'FREE_WARRANTY' | 'DELIVERY_ONLY' | 'REPAIR_CHARGE' | 'OUT_OF_WARRANTY' | 'REJECTED_CLAIM';

export interface WarrantyClaim {
  id: string;
  claimNumber: string;
  date: string;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  productId?: string | null;
  productName: string;
  invoiceNumber?: string;
  serialNumber?: string;
  fault: string;
  status: WarrantyClaimStatus;
  chargeType: WarrantyChargeType;
  supplierName?: string;
  repairCost: number;
  deliveryCharge: number;
  inspectionCharge: number;
  customerCharge: number;
  paidAmount: number;
  balanceDue: number;
  expectedDate?: string;
  notes?: string;
  updatedAt?: string;
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

export type AIProvider = 'auto' | 'gemini' | 'deepseek' | 'ollama-cloud' | 'local-phi' | 'groq' | 'zhipu';

export interface AIConfig {
  provider: AIProvider;
  model?: string;
}

export type PurchaseOrderStatus = 'PENDING' | 'APPROVED' | 'SHIPPED' | 'TRANSIT' | 'DELIVERED' | 'RECEIVED' | 'CANCELLED' | 'PARTIALLY_RECEIVED';

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
